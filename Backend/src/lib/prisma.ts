import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Ensure env vars are loaded before PrismaClient is constructed.
// prisma.ts is imported early in the module chain, before dotenv.config() in server.ts.
dotenv.config();

// In Prisma 7, the database URL is no longer read from schema.prisma at runtime.
// We must pass a driver adapter explicitly. PrismaPg wraps a pg connection pool.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// Create a single PrismaClient instance to be shared across the entire app.
// This prevents opening multiple DB connections unnecessarily.
const prisma = new PrismaClient({ adapter });

export default prisma;
