'use server';

import { revalidatePath } from 'next/cache';
import { runIngestion } from '@/server/ingestion/run-ingestion';

export async function runIngestionAction() {
  const result = await runIngestion('x-placeholder');
  revalidatePath('/');
  return result;
}
