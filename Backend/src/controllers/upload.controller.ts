import { Request, Response } from 'express';
import * as storageService from '../services/storage.service';
import * as productService from '../services/product.service';

// POST /api/uploads/raw
// Accepts a multipart image file, uploads it to Supabase Storage,
// and creates a ProductImage row.
// Body fields:
//   productId (optional) — link to an existing product immediately
//   isMain    (optional) — "true" to mark as the primary display image
//   order     (optional) — display order index (0-based)
// If productId is omitted, the image is stored unassigned for the bulk upload flow.
export const uploadRawImage = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const { productId, isMain, order } = req.body;

    // Upload buffer to Supabase raw-images bucket
    const rawUrl = await storageService.uploadRawImage(file.buffer, file.originalname);

    // Create a ProductImage row — productId may be null for bulk-upload flow
    const image = await productService.addProductImage(
      productId ?? null,
      rawUrl,
      isMain === 'true',
      order !== undefined ? parseInt(order, 10) : 0
    );

    res.status(200).json({ imageId: image.id, rawUrl, productId: image.productId ?? null });
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Upload failed' });
  }
};

// POST /api/uploads/bulk
// Accepts multiple files at once, uploads all to Storage, returns array of unassigned ProductImage rows.
export const uploadBulkImages = async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const rawUrl = await storageService.uploadRawImage(file.buffer, file.originalname);
        return productService.addProductImage(null, rawUrl, false, 0);
      })
    );

    res.status(200).json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Bulk upload failed' });
  }
};

// GET /api/uploads/unassigned
// Returns all ProductImage rows that have no productId (awaiting assignment).
export const getUnassignedImages = async (_req: Request, res: Response) => {
  try {
    const images = await productService.getUnassignedImages();
    res.status(200).json(images);
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Failed to fetch unassigned images' });
  }
};

// POST /api/uploads/assign
// Assigns a group of unassigned images to a newly created product.
// Body: { imageIds: string[], product: CreateProductInput }
// The first image in imageIds becomes the main image.
export const assignImagesToProduct = async (req: Request, res: Response) => {
  try {
    const { imageIds, product: productInput } = req.body as {
      imageIds: string[];
      product: import('../types/product.types').CreateProductInput;
    };

    if (!imageIds?.length) {
      res.status(400).json({ error: 'imageIds is required' });
      return;
    }
    if (!productInput?.name || !productInput?.sku || !productInput?.type) {
      res.status(400).json({ error: 'product name, sku, and type are required' });
      return;
    }

    // Create the product
    const product = await productService.createProduct(productInput);

    // Assign each image to the product, first one becomes main
    await Promise.all(
      imageIds.map((imageId, idx) =>
        productService.assignImageToProduct(imageId, product.id, idx === 0, idx)
      )
    );

    // Return the product with its now-assigned images
    const updated = await productService.getProductById(product.id);
    res.status(201).json(updated);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'A product with this SKU already exists' });
      return;
    }
    res.status(500).json({ error: error.message ?? 'Assignment failed' });
  }
};

// DELETE /api/uploads/image/:imageId
// Removes a ProductImage row and deletes its files from Storage.
export const deleteImage = async (req: Request, res: Response) => {
  try {
    const imageId = String(req.params.imageId);
    const image = await productService.getProductImageById(imageId);
    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    if (image.rawUrl) {
      await storageService.deleteFileBySignedUrl(image.rawUrl, 'raw-images');
    }
    if (image.processedUrl) {
      await storageService.deleteFileBySignedUrl(image.processedUrl, 'processed-images');
    }

    await productService.deleteProductImage(imageId);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Delete failed' });
  }
};

// PATCH /api/uploads/image/:imageId/main
// Sets this image as the main image for its product.
export const setMainImage = async (req: Request, res: Response) => {
  try {
    const imageId = String(req.params.imageId);
    const image = await productService.getProductImageById(imageId);
    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    if (!image.productId) {
      res.status(400).json({ error: 'Image is not assigned to a product yet' });
      return;
    }
    const updated = await productService.setMainImage(image.productId, imageId);
    res.status(200).json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Failed to set main image' });
  }
};
