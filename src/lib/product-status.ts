// Deliberately has zero dependencies — client components import the status
// enum from here, never from @/db/schema, so drizzle-orm never ends up in
// the browser bundle. db/schema.ts imports this file, not the other way.
export const PRODUCT_STATUSES = [
  "researching",
  "shortlisted",
  "listed",
  "winner",
  "rejected",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
