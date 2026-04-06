import { Request, Response } from 'express';
import * as storageService from '../services/storage.service';
import * as productService from '../services/product.service';

// POST /api/uploads/raw
// Accepts a multipart image file, uploads it to Supabase Storage,
// and optionally links it to an existing product via productId in the body.
export const uploadRawImage = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    // Upload buffer to Supabase raw-images bucket
    const storagePath = await storageService.uploadRawImage(file.buffer, file.originalname);

    // If a productId was provided, immediately link the raw image to the product
    const { productId } = req.body;
    if (productId) {
      await productService.updateProduct(productId, { rawImageUrl: storagePath });
    }

    res.status(200).json({ storagePath, productId: productId ?? null });
  } catch (error: any) {
    res.status(500).json({ error: error.message ?? 'Upload failed' });
  }
};
