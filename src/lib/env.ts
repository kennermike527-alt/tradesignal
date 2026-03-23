import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  INGESTION_API_KEY: z.string().optional(),
  INGESTION_GENERATE_SUMMARIES: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v !== 'false'),
});

export const env = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  INGESTION_API_KEY: process.env.INGESTION_API_KEY,
  INGESTION_GENERATE_SUMMARIES: process.env.INGESTION_GENERATE_SUMMARIES,
});
