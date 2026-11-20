/**
 * Builds the 1,000-product catalog from a fixed seed (D-01). Same seed → byte-identical catalog.
 *
 * Each product draws from its own sub-stream (`deriveSeed(seed, index)`), so changing how one
 * product is generated never shifts the prices or ratings of the products after it.
 */
import { deriveSeed, mulberry32, pick, pickWeighted, randFloat, shuffle, type Rng } from '../rng';
import { SEED, type CatalogSeed } from './seed';
import { fullImageUri } from './images';
import type { CategoryId, Product } from './types';

const CATEGORY_SHUFFLE_SALT = 0x0c47;

/** Cents part of a price, and how often each one appears. Real shelves mostly end in .95 / .00. */
const PRICE_ENDINGS = [0, 50, 95, 99] as const;
const PRICE_ENDING_WEIGHTS = [3, 2, 3, 2] as const;

const SKU_PREFIX: Record<CategoryId, string> = {
  vitamins: 'VIT',
  skincare: 'SKN',
  'baby-care': 'BBY',
  'personal-care': 'PRS',
  medicines: 'MED',
  'hair-care': 'HAR',
  fitness: 'FIT',
  fragrance: 'FRG',
};

export function productId(index: number): string {
  return `p-${String(index).padStart(4, '0')}`;
}

/** Price in halalas inside the category band, skewed towards the cheaper end like a real shelf. */
function drawPriceHalalas(rng: Rng, minSar: number, maxSar: number): number {
  const skewed = Math.pow(rng(), 1.6);
  const whole = Math.floor(minSar + skewed * (maxSar - minSar));
  const ending = pickWeighted(rng, PRICE_ENDINGS, PRICE_ENDING_WEIGHTS);
  let priceH = whole * 100 + ending;
  const minH = Math.round(minSar * 100);
  const maxH = Math.round(maxSar * 100);
  if (priceH < minH) priceH = minH;
  if (priceH > maxH) priceH = (whole - 1) * 100 + ending;
  return priceH;
}

/** Old price 10–40 % above the price, always ending in .95. */
function drawOldPriceHalalas(rng: Rng, priceH: number): number {
  const factor = randFloat(rng, 1.1, 1.4);
  return Math.ceil((priceH * factor) / 100) * 100 - 5;
}

/** Pale, low-saturation colour for the image placeholder (HSL → hex, built at runtime). */
function drawPlaceholderColor(rng: Rng): string {
  const h = rng() * 360;
  const s = randFloat(rng, 0.22, 0.38);
  const l = randFloat(rng, 0.86, 0.91);
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + channel(0) + channel(8) + channel(4);
}

interface NameParts {
  brand: { en: string; ar: string };
  type: readonly [string, string];
  variant: readonly [string, string];
}

/**
 * Picks brand × type × variant until the English name is new within the category.
 * Falls back to walking every combination in order, so it always terminates deterministically.
 */
function drawUniqueName(rng: Rng, seed: CatalogSeed, category: CategoryId, used: Set<string>): NameParts {
  const brands = seed.brands.filter((b) => b.for.includes(category));
  const types = seed.types[category];
  const variants = seed.variants[category];
  const nameOf = (p: NameParts) => `${p.brand.en} ${p.type[0]} ${p.variant[0]}`;

  for (let attempt = 0; attempt < 24; attempt++) {
    const parts: NameParts = { brand: pick(rng, brands), type: pick(rng, types), variant: pick(rng, variants) };
    if (!used.has(nameOf(parts))) return parts;
  }
  for (const brand of brands) {
    for (const type of types) {
      for (const variant of variants) {
        const parts: NameParts = { brand, type, variant };
        if (!used.has(nameOf(parts))) return parts;
      }
    }
  }
  throw new Error(`Category ${category} has fewer name combinations than products`);
}

export function generateCatalog(seed: CatalogSeed = SEED): Product[] {
  const categoryIds = seed.categories.map((c) => c.id);
  const slots = Array.from({ length: seed.total }, (_, i) => categoryIds[i % categoryIds.length] as CategoryId);
  const categoryOrder = shuffle(mulberry32(deriveSeed(seed.seed, CATEGORY_SHUFFLE_SALT)), slots);

  const usedNames = new Map<CategoryId, Set<string>>(categoryIds.map((id) => [id, new Set<string>()]));
  const products: Product[] = [];

  for (let index = 1; index <= seed.total; index++) {
    const rng = mulberry32(deriveSeed(seed.seed, index));
    const id = productId(index);
    const category = categoryOrder[index - 1] as CategoryId;
    const band = seed.categories.find((c) => c.id === category);
    if (!band) throw new Error(`Unknown category ${category}`);

    const used = usedNames.get(category) as Set<string>;
    const { brand, type, variant } = drawUniqueName(rng, seed, category, used);
    const name = `${brand.en} ${type[0]} ${variant[0]}`;
    used.add(name);

    const priceH = drawPriceHalalas(rng, band.priceMin, band.priceMax);
    const onOffer = rng() < 0.35;
    const oldPriceH = onOffer ? drawOldPriceHalalas(rng, priceH) : null;
    const rating = Math.min(4.9, Math.round((3.4 + 1.5 * Math.sqrt(rng())) * 10) / 10);
    const reviews = Math.floor(Math.exp(rng() * Math.log(2401))) - 1;
    const inStock = rng() < 0.92;
    const description = seed.descriptions[category];

    products.push({
      id,
      name,
      nameAr: `${brand.ar} ${type[1]} ${variant[1]}`,
      brand: brand.en,
      brandAr: brand.ar,
      category,
      price: priceH / 100,
      oldPrice: oldPriceH === null ? null : oldPriceH / 100,
      currency: 'SAR',
      rating,
      reviews,
      inStock,
      images: [1, 2, 3].map((n) => fullImageUri(id, n)),
      sku: `AD-${SKU_PREFIX[category]}-${String(index).padStart(4, '0')}`,
      descriptionEn: description[0],
      descriptionAr: description[1],
      dominantColor: drawPlaceholderColor(rng),
    });
  }
  return products;
}

/** Whole-number discount shown on the badge, or 0 when not on offer. */
export function discountPercent(product: Pick<Product, 'price' | 'oldPrice'>): number {
  if (product.oldPrice === null || product.oldPrice <= product.price) return 0;
  return Math.round((1 - product.price / product.oldPrice) * 100);
}

/** Home's "Best sellers": the 12 in-stock products with the strongest rating × review signal, max 2 per category. */
export function pickBestSellers(products: readonly Product[], count = 12): Product[] {
  const score = (p: Product) => p.rating * Math.log1p(p.reviews);
  const ranked = products
    .filter((p) => p.inStock)
    .slice()
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const perCategory = new Map<CategoryId, number>();
  const out: Product[] = [];
  for (const p of ranked) {
    const taken = perCategory.get(p.category) ?? 0;
    if (taken >= 2) continue;
    perCategory.set(p.category, taken + 1);
    out.push(p);
    if (out.length === count) break;
  }
  return out;
}
