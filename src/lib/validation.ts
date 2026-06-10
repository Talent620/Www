import { z } from 'zod';
import type { Brief } from './ai/types';

export const briefSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(120),
  industry: z.string().min(1, 'Industry is required').max(120),
  description: z.string().min(10, 'Please describe the business in at least 10 characters').max(2000),
  style: z.string().min(1).max(60).default('modern'),
  locales: z.array(z.string().min(2).max(10)).min(1).default(['en']),
  kind: z.enum(['WEBSITE', 'STORE']).default('WEBSITE'),
});

export type BriefInput = z.infer<typeof briefSchema>;

/** Parse and normalise an untrusted payload into a valid Brief. */
export function parseBrief(payload: unknown): Brief {
  const parsed = briefSchema.parse(payload);
  return {
    ...parsed,
    locales: [...new Set(parsed.locales.map((l) => l.trim().toLowerCase()))],
  };
}
