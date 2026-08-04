import {
  createLoader,
  debounce,
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";
import { PRODUCT_STATUSES, type ProductStatus } from "@/lib/product-status";

/**
 * Shared between the client grid (useQueryStates) and the server page
 * (createLoader below) so both sides parse the exact same URL params the
 * exact same way — the server needs this to run the query, the client needs
 * it to drive the toolbar and update the URL.
 */
export const filterParsers = {
  page: parseAsInteger.withDefault(1),
  // Per-key options replace (not merge with) the hook-level options, so
  // `shallow: false` has to be repeated here too, or typing would only ever
  // update the URL client-side and never re-run the server query.
  q: parseAsString.withDefault("").withOptions({ limitUrlUpdates: debounce(300), shallow: false }),
  status: parseAsArrayOf(parseAsStringEnum<ProductStatus>([...PRODUCT_STATUSES])).withDefault([]),
  category: parseAsString.withDefault(""),
  minMargin: parseAsFloat.withDefault(0),
  sort: parseAsString.withDefault(""),
  dir: parseAsStringEnum(["asc", "desc"]).withDefault("desc"),
};

export const loadPipelineSearchParams = createLoader(filterParsers);
