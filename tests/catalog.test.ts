/**
 * The seeded catalog (D-01, D-02, D-06, D-08): identical on every run, and shaped like a real shelf.
 */
import { toCentimes } from '@/core/money';
import {
  CATEGORIES,
  discountPercent,
  generateCatalog,
  getCatalog,
  imageBucket,
  imageUri,
  pickBestSellers,
  type Product,
} from '@/core/catalog';
import { SEED } from '@/core/catalog/seed';

/** FNV-1a over the serialised catalog: any change to any field of any product changes it. */
function fingerprint(products: readonly Product[]): string {
  const text = JSON.stringify(products);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

const products = generateCatalog(SEED);

describe('determinism (D-01)', () => {
  it('generates the same 1,000 products every time', () => {
    expect(generateCatalog(SEED)).toEqual(products);
  });

  it('matches the pinned fingerprint (a changed generator must be a deliberate, reviewed change)', () => {
    // Last changed when prices moved to whole Algerian dinars in 50 DA steps and the currency to DZD.
    expect(fingerprint(products)).toBe('59e22f0f');
  });

  it('a different seed gives a different catalog', () => {
    expect(fingerprint(generateCatalog({ ...SEED, seed: SEED.seed + 1 }))).not.toBe(fingerprint(products));
  });

  it('getCatalog() memoises and indexes by id', () => {
    const catalog = getCatalog();
    expect(getCatalog()).toBe(catalog);
    expect(catalog.products).toEqual(products);
    expect(catalog.byId.size).toBe(1000);
    expect(catalog.byId.get('p-0042')).toBe(catalog.products[41]);
  });
});

describe('shape (D-02)', () => {
  it('ids run p-0001 … p-1000', () => {
    expect(products).toHaveLength(1000);
    expect(products[0]?.id).toBe('p-0001');
    expect(products[999]?.id).toBe('p-1000');
    expect(new Set(products.map((p) => p.id)).size).toBe(1000);
  });

  it('every product has the brief fields with sane values', () => {
    for (const p of products) {
      expect(p.currency).toBe('DZD');
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.nameAr.length).toBeGreaterThan(0);
      expect(p.brand.length).toBeGreaterThan(0);
      expect(p.rating).toBeGreaterThanOrEqual(3.4);
      expect(p.rating).toBeLessThanOrEqual(4.9);
      expect(Math.round(p.rating * 10)).toBeCloseTo(p.rating * 10, 6);
      expect(Number.isInteger(p.reviews)).toBe(true);
      expect(p.reviews).toBeGreaterThanOrEqual(0);
      expect(p.reviews).toBeLessThanOrEqual(2400);
      expect(typeof p.inStock).toBe('boolean');
      expect(p.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('Arabic names contain Arabic script', () => {
    for (const p of products) expect(p.nameAr).toMatch(/[؀-ۿ]/);
  });

  it('uses Western digits in Arabic, like the UI copy (ADR-028): no "60 tablets" next to "٦٠ قرصاً"', () => {
    const EASTERN_DIGITS = /[٠-٩۰-۹]/;
    expect(JSON.stringify(SEED)).not.toMatch(EASTERN_DIGITS);
    for (const p of products) expect(p.nameAr).not.toMatch(EASTERN_DIGITS);
  });
});

describe('categories (D-08)', () => {
  it('has the 8 brief categories, 125 products each', () => {
    expect(CATEGORIES.map((c) => c.en)).toEqual([
      'Vitamins',
      'Skincare',
      'Baby care',
      'Personal care',
      'Medicines',
      'Hair care',
      'Fitness',
      'Fragrance',
    ]);
    for (const c of CATEGORIES) {
      expect(products.filter((p) => p.category === c.id)).toHaveLength(125);
    }
  });

  it('names are unique inside each category', () => {
    for (const c of CATEGORIES) {
      const names = products.filter((p) => p.category === c.id).map((p) => p.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('categories are interleaved, not in blocks (the first page is a mix)', () => {
    const firstPage = new Set(products.slice(0, 20).map((p) => p.category));
    expect(firstPage.size).toBeGreaterThanOrEqual(5);
  });
});

describe('prices', () => {
  it('stay inside the category band and are whole dinars in steps of 50 DA', () => {
    for (const p of products) {
      const band = CATEGORIES.find((c) => c.id === p.category);
      const priceH = toCentimes(p.price);
      expect(priceH).toBeGreaterThanOrEqual(toCentimes(band?.priceMin ?? Number.NaN));
      expect(priceH).toBeLessThanOrEqual(toCentimes(band?.priceMax ?? Number.NaN));
      expect(priceH % 5000).toBe(0);
      // The display float round-trips to the same integer: no 49.949999 prices.
      expect(priceH / 100).toBe(p.price);
    }
  });

  it('about 35 % are on offer, 10–40 % above the price', () => {
    const onOffer = products.filter((p) => p.oldPrice !== null);
    expect(onOffer.length).toBeGreaterThan(300);
    expect(onOffer.length).toBeLessThan(400);
    for (const p of onOffer) {
      const oldH = toCentimes(p.oldPrice ?? 0);
      const priceH = toCentimes(p.price);
      expect(oldH).toBeGreaterThan(priceH);
      expect(oldH % 5000).toBe(0);
      expect(discountPercent(p)).toBeGreaterThanOrEqual(5);
      expect(discountPercent(p)).toBeLessThanOrEqual(30);
    }
  });

  it('discountPercent is 0 when not on offer', () => {
    expect(discountPercent({ price: 10, oldPrice: null })).toBe(0);
    expect(discountPercent({ price: 10, oldPrice: 8 })).toBe(0);
    expect(discountPercent({ price: 75, oldPrice: 100 })).toBe(25);
  });

  it('about 92 % are in stock', () => {
    const inStock = products.filter((p) => p.inStock).length;
    expect(inStock).toBeGreaterThan(880);
    expect(inStock).toBeLessThan(960);
  });
});

describe('images (D-06)', () => {
  it('each product has 3 seeded picsum originals', () => {
    for (const p of products) {
      expect(p.images).toEqual([1, 2, 3].map((n) => `https://picsum.photos/seed/${p.id}-${n}/800/800`));
    }
  });

  it('requests the drawn size, snapped to a bucket', () => {
    // A 170 dp grid tile on a 2.625× phone needs 447 px → the 480 bucket, not 800.
    expect(imageBucket(170, 2.625)).toBe(480);
    expect(imageBucket(56, 3)).toBe(240);
    expect(imageBucket(60, 2)).toBe(160);
    expect(imageBucket(400, 3)).toBe(800);
    expect(imageUri('p-0001', 1, 170, 2.625)).toBe('https://picsum.photos/seed/p-0001-1/480/480');
  });
});

describe('best sellers', () => {
  it('are 12 in-stock products, at most 2 per category, stable', () => {
    const best = pickBestSellers(products);
    expect(best).toHaveLength(12);
    expect(best.every((p) => p.inStock)).toBe(true);
    const perCategory = new Map<string, number>();
    for (const p of best) perCategory.set(p.category, (perCategory.get(p.category) ?? 0) + 1);
    expect(Math.max(...perCategory.values())).toBeLessThanOrEqual(2);
    expect(getCatalog().bestSellers.map((p) => p.id)).toEqual(best.map((p) => p.id));
  });
});

describe('fixture', () => {
  it('the seed file matches what the generator assumes', () => {
    expect(SEED.seed).toBe(20261116);
    expect(SEED.total).toBe(1000);
    expect(SEED.pageSize).toBe(20);
    expect(SEED.perCategory * SEED.categories.length).toBe(SEED.total);
    for (const c of SEED.categories) {
      expect(SEED.types[c.id].length).toBeGreaterThan(0);
      expect(SEED.variants[c.id].length).toBeGreaterThan(0);
      expect(SEED.descriptions[c.id]).toHaveLength(2);
      expect(SEED.brands.some((b) => b.for.includes(c.id))).toBe(true);
      expect(c.priceMin).toBeLessThan(c.priceMax);
    }
    for (const b of SEED.banners) {
      expect(b.en.title.length).toBeGreaterThan(0);
      expect(b.ar.title.length).toBeGreaterThan(0);
    }
  });
});
