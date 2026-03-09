// prisma.config.ts
import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Standard connection (with pooling)
    url: process.env.DATABASE_URL,
    // Direct connection (required for migrations)
    directUrl: process.env.DIRECT_URL,
  },
});