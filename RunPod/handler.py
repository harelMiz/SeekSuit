import sys
sys.path.insert(0, "/workspace/scripts")

from runpod_handler import handler
import runpod

runpod.serverless.start({"handler": handler})
