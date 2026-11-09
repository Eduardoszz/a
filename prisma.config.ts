import "dotenv/config";
import { defineConfig } from "prisma/config";

// As migrações usam a conexão direta (sem pooler) quando existir.
// Na Vercel + Neon, a integração cria DATABASE_URL (pooled) e DATABASE_URL_UNPOOLED.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
