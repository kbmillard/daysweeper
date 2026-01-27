import { defineConfig } from 'prisma/config';
import { config } from 'dotenv';

// Load .env.vercel for production migrations
config({ path: '.env.vercel' });

const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED must be set');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Use unpooled connection for migrations (Neon best practice)
    url: databaseUrl
  }
});
