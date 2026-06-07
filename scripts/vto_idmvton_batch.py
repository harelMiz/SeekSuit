"""
IDM-VTON batch test — runs garments from vto_samples/ through IDM-VTON.
Designed to run on RunPod (CUDA GPU required).

Setup (run once on RunPod):
  python scripts/vto_idmvton_download.py

Usage:
  cd /workspace/SeekSuit
  python scripts/vto_idmvton_batch.py --one      # quick test with 1 garment
  python scripts/vto_idmvton_batch.py            # run all garments
"""

import sys
import os
import argparse
from pathlib import Path

IDMVTON_DEMO = Path("/workspace/IDM-VTON/gradio_demo")
sys.path.insert(0, str(IDMVTON_DEMO))
os.chdir(IDMVTON_DEMO)

import torch
from PIL import Image
from torchvision import transforms
from torchvision.transforms.functional import to_pil_image
from transformers import (
    CLIPImageProcessor,
    CLIPVisionModelWithProjection,
    CLIPTextModel,
    CLIPTextModelWithProjection,
    AutoTokenizer,
)
from diffusers import DDPMScheduler, AutoencoderKL
from detectron2.data.detection_utils import convert_PIL_to_numpy, _apply_exif_orientation

from src.tryon_pipeline import StableDiffusionXLInpaintPipeline as TryonPipeline
from src.unet_hacked_garmnet import UNet2DConditionModel as UNet2DConditionModel_ref
from src.unet_hacked_tryon import UNet2DConditionModel
from utils_mask import get_mask_location
import apply_net
from preprocess.humanparsing.run_parsing import Parsing
from preprocess.openpose.run_openpose import OpenPose

SCRIPTS_DIR = Path(__file__).parent
SAMPLES_DIR = SCRIPTS_DIR / "vto_samples"
OUTPUT_DIR  = SCRIPTS_DIR / "vto_results_idmvton"
MODEL_IMAGE = SCRIPTS_DIR.parent / "Management" / "Architecture" / "model.png"

BASE_PATH = "yisol/IDM-VTON"
DEVICE    = "cuda:0"

WIDTH  = 768
HEIGHT = 1024
STEPS  = 30
SEED   = 42

CLOTH_TYPE = {
    "JACKETS": "upper_body",
    "VESTS":   "upper_body",
    "PANTS":   "lower_body",
}

GARMENT_DESC = {
    "JACKETS": "suit jacket",
    "VESTS":   "suit vest",
    "PANTS":   "suit pants",
}

tensor_transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize([0.5], [0.5]),
])


def load_models():
    print("Loading IDM-VTON model components...")

    unet = UNet2DConditionModel.from_pretrained(BASE_PATH, subfolder="unet", torch_dtype=torch.float16)
    unet.requires_grad_(False)

    tokenizer_one = AutoTokenizer.from_pretrained(BASE_PATH, subfolder="tokenizer", use_fast=False)
    tokenizer_two = AutoTokenizer.from_pretrained(BASE_PATH, subfolder="tokenizer_2", use_fast=False)

    noise_scheduler = DDPMScheduler.from_pretrained(BASE_PATH, subfolder="scheduler")

    text_encoder_one = CLIPTextModel.from_pretrained(BASE_PATH, subfolder="text_encoder", torch_dtype=torch.float16)
    text_encoder_two = CLIPTextModelWithProjection.from_pretrained(BASE_PATH, subfolder="text_encoder_2", torch_dtype=torch.float16)
    image_encoder   = CLIPVisionModelWithProjection.from_pretrained(BASE_PATH, subfolder="image_encoder", torch_dtype=torch.float16)
    vae             = AutoencoderKL.from_pretrained(BASE_PATH, subfolder="vae", torch_dtype=torch.float16)
    unet_encoder    = UNet2DConditionModel_ref.from_pretrained(BASE_PATH, subfolder="unet_encoder", torch_dtype=torch.float16)

    for m in [unet_encoder, image_encoder, vae, unet, text_encoder_one, text_encoder_two]:
        m.requires_grad_(False)

    pipe = TryonPipeline.from_pretrained(
        BASE_PATH,
        unet=unet,
        vae=vae,
        feature_extractor=CLIPImageProcessor(),
        text_encoder=text_encoder_one,
        text_encoder_2=text_encoder_two,
        tokenizer=tokenizer_one,
        tokenizer_2=tokenizer_two,
        scheduler=noise_scheduler,
        image_encoder=image_encoder,
        torch_dtype=torch.float16,
    )
    pipe.unet_encoder = unet_encoder

    print("Loading parsing and pose models...")
    parsing_model  = Parsing(0)
    openpose_model = OpenPose(0)

    return pipe, parsing_model, openpose_model


def run_vto(pipe, parsing_model, openpose_model,
            person: Image.Image, garment: Image.Image,
            cloth_type: str, garment_desc: str) -> Image.Image:

    openpose_model.preprocessor.body_estimation.model.to(DEVICE)
    pipe.to(DEVICE)
    pipe.unet_encoder.to(DEVICE)

    garm_img   = garment.convert("RGB").resize((WIDTH, HEIGHT))
    human_img  = person.convert("RGB").resize((WIDTH, HEIGHT))

    keypoints    = openpose_model(human_img.resize((384, 512)))
    model_parse, _ = parsing_model(human_img.resize((384, 512)))
    mask, _ = get_mask_location('hd', cloth_type, model_parse, keypoints)
    mask = mask.resize((WIDTH, HEIGHT))

    human_img_arg = _apply_exif_orientation(human_img.resize((384, 512)))
    human_img_arg = convert_PIL_to_numpy(human_img_arg, format="BGR")

    args = apply_net.create_argument_parser().parse_args((
        'show',
        './configs/densepose_rcnn_R_50_FPN_s1x.yaml',
        './ckpt/densepose/model_final_162be9.pkl',
        'dp_segm', '-v',
        '--opts', 'MODEL.DEVICE', 'cuda',
    ))
    pose_img = args.func(args, human_img_arg)
    pose_img = pose_img[:, :, ::-1]
    pose_img = Image.fromarray(pose_img).resize((WIDTH, HEIGHT))

    with torch.no_grad():
        with torch.cuda.amp.autocast():
            with torch.inference_mode():
                prompt = "model is wearing " + garment_desc
                neg    = "monochrome, lowres, bad anatomy, worst quality, low quality"
                (prompt_embeds, neg_embeds,
                 pooled_embeds, neg_pooled_embeds) = pipe.encode_prompt(
                    prompt,
                    num_images_per_prompt=1,
                    do_classifier_free_guidance=True,
                    negative_prompt=neg,
                )
                (prompt_embeds_c, _, _, _) = pipe.encode_prompt(
                    ["a photo of " + garment_desc],
                    num_images_per_prompt=1,
                    do_classifier_free_guidance=False,
                    negative_prompt=[neg],
                )

            pose_tensor = tensor_transform(pose_img).unsqueeze(0).to(DEVICE, torch.float16)
            garm_tensor = tensor_transform(garm_img).unsqueeze(0).to(DEVICE, torch.float16)
            generator   = torch.Generator(DEVICE).manual_seed(SEED)

            images = pipe(
                prompt_embeds=prompt_embeds.to(DEVICE, torch.float16),
                negative_prompt_embeds=neg_embeds.to(DEVICE, torch.float16),
                pooled_prompt_embeds=pooled_embeds.to(DEVICE, torch.float16),
                negative_pooled_prompt_embeds=neg_pooled_embeds.to(DEVICE, torch.float16),
                num_inference_steps=STEPS,
                generator=generator,
                strength=1.0,
                pose_img=pose_tensor,
                text_embeds_cloth=prompt_embeds_c.to(DEVICE, torch.float16),
                cloth=garm_tensor,
                mask_image=mask,
                image=human_img,
                height=HEIGHT,
                width=WIDTH,
                ip_adapter_image=garm_img,
                guidance_scale=2.0,
            )[0]

    return images[0]


def get_person_path() -> Path:
    for p in [MODEL_IMAGE, MODEL_IMAGE.with_suffix(".jpg")]:
        if p.exists():
            return p
    print(f"[ERROR] model image not found at {MODEL_IMAGE}")
    sys.exit(1)


def collect_samples() -> list[tuple[str, Path]]:
    items = []
    for type_dir in sorted(SAMPLES_DIR.iterdir()):
        if not type_dir.is_dir():
            continue
        for img in sorted(type_dir.glob("*.jpg")):
            items.append((type_dir.name, img))
    return items


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--one", action="store_true", help="Run only the first garment as a quick test")
    args = parser.parse_args()

    person_path = get_person_path()
    samples = collect_samples()
    if not samples:
        print(f"[ERROR] No images found in {SAMPLES_DIR}")
        sys.exit(1)

    if args.one:
        samples = samples[:1]
        print("Quick test — 1 garment.\n")

    pipe, parsing_model, openpose_model = load_models()
    person_img = Image.open(person_path).convert("RGB")

    OUTPUT_DIR.mkdir(exist_ok=True)
    print(f"\nRunning IDM-VTON for {len(samples)} garment(s)...\n")

    ok = err = 0
    for ptype, img_path in samples:
        cloth_type   = CLOTH_TYPE.get(ptype, "upper_body")
        garment_desc = GARMENT_DESC.get(ptype, "suit jacket")
        out_dir  = OUTPUT_DIR / ptype
        out_dir.mkdir(exist_ok=True)
        out_path = out_dir / f"{img_path.stem}_vto.jpg"

        print(f"  [{ptype}/{cloth_type}] {img_path.stem} ... ", end="", flush=True)
        try:
            garment = Image.open(img_path).convert("RGB")
            result  = run_vto(pipe, parsing_model, openpose_model,
                              person_img, garment, cloth_type, garment_desc)
            result.save(out_path, quality=92)
            print("ok")
            ok += 1
        except Exception as e:
            print(f"FAIL  {e}")
            err += 1

    print(f"\nDone — {ok} ok, {err} failed")
    print(f"Results saved to: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
