import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

// Converts page and limit values into a Supabase inclusive range.
export function paginationRange(page: number, limit: number) {
  const from = (page - 1) * limit;
  return { from, to: from + limit - 1 };
}

// Calculates collection metadata without exposing database details.
export function paginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
