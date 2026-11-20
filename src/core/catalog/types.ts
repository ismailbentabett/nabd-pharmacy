/** The brief's product shape (D-02) plus a few deterministic extras used for placeholders and the product page. */
export type CategoryId =
  | 'vitamins'
  | 'skincare'
  | 'baby-care'
  | 'personal-care'
  | 'medicines'
  | 'hair-care'
  | 'fitness'
  | 'fragrance';

export interface Product {
  id: string;
  name: string;
  nameAr: string;
  brand: string;
  brandAr: string;
  category: CategoryId;
  /** DA (Algerian dinar), TVA included. Converted to centimes before any arithmetic. */
  price: number;
  /** Pre-discount DA price, or null when the product is not on offer. */
  oldPrice: number | null;
  currency: 'DZD';
  rating: number;
  reviews: number;
  inStock: boolean;
  /** Full-size (800 px) picsum URLs. Screens call `imageUri()` to request the displayed size instead. */
  images: string[];
  sku: string;
  descriptionEn: string;
  descriptionAr: string;
  /** Hex colour of the image placeholder, derived from the seed so it is stable per product. */
  dominantColor: string;
}

export interface Category {
  id: CategoryId;
  en: string;
  ar: string;
  /** lucide icon name. */
  icon: string;
  priceMin: number;
  priceMax: number;
}

export interface BannerCopy {
  title: string;
  sub: string;
  cta: string;
}

export interface Banner {
  id: string;
  en: BannerCopy;
  ar: BannerCopy;
  category: CategoryId | null;
  tint: 'primary' | 'secondary';
}
