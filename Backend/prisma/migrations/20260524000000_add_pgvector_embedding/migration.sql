-- Enable pgvector extension (already available in Supabase by default)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add CLIP embedding column to ProductImage
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS embedding vector(512);

-- IVFFlat index for fast approximate cosine similarity search.
-- lists=10 is appropriate for small-to-medium catalogs (<10k images).
-- Re-create with more lists if the catalog grows beyond ~50k images.
CREATE INDEX IF NOT EXISTS "ProductImage_embedding_idx"
    ON "ProductImage" USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10);
