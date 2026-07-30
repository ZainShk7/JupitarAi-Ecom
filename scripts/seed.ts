/**
 * Seeds 2,000 realistic-looking products for perf/profiling work (60fps
 * grid target) plus the single default settings row. Re-runnable: clears
 * products first, but leaves settings alone if a row already exists.
 */
import { faker } from "@faker-js/faker";
import { nanoid } from "nanoid";
import { db } from "../src/db";
import {
  DEFAULT_FX_RATES,
  SETTINGS_ROW_ID,
  products,
  settings,
  type NewProduct,
  type ProductStatus,
} from "../src/db/schema";
import { type CurrencyCode } from "../src/lib/money";

const CATEGORIES = [
  "Mobile Accessories",
  "Home & Kitchen",
  "Pet Supplies",
  "Fitness & Outdoors",
  "Beauty & Personal Care",
  "Tools & Home Improvement",
  "Toys & Games",
  "Office & Stationery",
  "Car Accessories",
  "Garden & Patio",
] as const;

const ADJECTIVES = [
  "Wireless",
  "Portable",
  "Heavy Duty",
  "Foldable",
  "Multifunctional",
  "Adjustable",
  "Waterproof",
  "Rechargeable",
  "Premium",
  "Mini",
  "Universal",
];

const MATERIALS = [
  "Stainless Steel",
  "Silicone",
  "Wooden",
  "Aluminum Alloy",
  "ABS Plastic",
  "Leather",
  "Bamboo",
  "Carbon Fiber",
];

const USE_CASE_SUFFIXES = [
  "for Home Office Storage Organizer",
  "Kitchen Gadget Tool Accessory Set",
  "Outdoor Camping Travel Gear Bundle",
  "Car Phone Holder Mount Stand",
  "Desktop Organizer Stationery Bookshelf",
  "Pet Grooming Cleaning Tool Kit",
  "Fitness Training Equipment Set",
  "Bathroom Storage Rack Shelf Holder",
  "Baby Feeding Care Accessory Pack",
  "Travel Makeup Cosmetic Organizer Bag",
];

function weightedPick<T extends string>(pairs: Array<[T, number]>): T {
  const total = pairs.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of pairs) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return pairs[pairs.length - 1][0];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCurrency(): CurrencyCode {
  // AliExpress listings skew heavily USD-priced; GBP/EUR/AUD/PKR fill the rest.
  return weightedPick<CurrencyCode>([
    ["USD", 0.45],
    ["GBP", 0.2],
    ["EUR", 0.15],
    ["AUD", 0.1],
    ["PKR", 0.1],
  ]);
}

function randomStatus(): ProductStatus {
  return weightedPick<ProductStatus>([
    ["researching", 0.5],
    ["shortlisted", 0.2],
    ["listed", 0.15],
    ["winner", 0.05],
    ["rejected", 0.1],
  ]);
}

/** Long, keyword-stuffed titles — matches the real AliExpress listing style (100+ chars). */
function buildProductName(): string {
  const parts = [
    faker.helpers.arrayElement(ADJECTIVES),
    faker.commerce.productName(),
    faker.helpers.arrayElement(MATERIALS),
    faker.commerce.productAdjective(),
    faker.helpers.arrayElement(USE_CASE_SUFFIXES),
  ];
  let name = parts.join(" ");
  while (name.length < 100) {
    name += ` ${faker.helpers.arrayElement(USE_CASE_SUFFIXES)}`;
  }
  return name;
}

function buildProduct(now: number): NewProduct {
  const currency = randomCurrency();
  const fxRate = DEFAULT_FX_RATES[currency];
  // Pick a realistic landed-cost range in GBP terms first (£1.50-£45.00),
  // then convert back into the source currency's own minor units — a
  // shared minor-units range across currencies would make a low-value
  // currency like PKR look nearly free.
  const costGBPPence = randomInt(150, 4500);
  const costPriceAmount = Math.round(costGBPPence / fxRate);

  // Markup skews realistic-but-varied so the seed produces the full spread
  // of verdicts (strong/viable/marginal/kill), not just winners.
  const markup = faker.number.float({ min: 1.3, max: 4.5, fractionDigits: 2 });
  const targetPrice = Math.max(Math.round(costGBPPence * markup), 99);

  const createdAt = new Date(now - randomInt(0, 120) * 24 * 60 * 60 * 1000);
  const updatedAt = new Date(createdAt.getTime() + randomInt(0, 20) * 24 * 60 * 60 * 1000);

  return {
    id: nanoid(),
    name: buildProductName(),
    category: faker.helpers.arrayElement(CATEGORIES),
    sourceUrl: `https://aliexpress.com/item/${faker.string.numeric(13)}.html`,
    costPriceAmount,
    costPriceCurrency: currency,
    deliveryDays: randomInt(5, 45),
    targetPrice,
    competitorSoldCount: faker.helpers.maybe(() => randomInt(0, 8000), { probability: 0.9 }) ?? null,
    status: randomStatus(),
    notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }) ?? null,
    createdAt,
    updatedAt,
  };
}

async function seedSettings() {
  await db
    .insert(settings)
    .values({
      id: SETTINGS_ROW_ID,
      ebayFeePercent: 12.8,
      ebayFeeFixedPence: 30,
      promotedAdPercent: 0,
      inboundShippingPence: 0,
      minMarginPercent: 20,
      maxDeliveryDays: 20,
      vatPercent: 0,
      fxRates: DEFAULT_FX_RATES,
    })
    .onConflictDoNothing();
}

async function seedProducts(count: number) {
  await db.delete(products);

  const now = Date.now();
  const rows: NewProduct[] = Array.from({ length: count }, () => buildProduct(now));

  const BATCH_SIZE = 50; // stays well under SQLite's per-statement bound-parameter limit
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.insert(products).values(rows.slice(i, i + BATCH_SIZE));
  }
}

async function main() {
  const count = 2000;
  await seedSettings();
  await seedProducts(count);
  console.log(`Seeded ${count} products and ensured the default settings row exists.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
