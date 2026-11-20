/**
 * Every testID the tests and the Maestro flows (`scripts/perf/flows/*.yaml`) look for, in one table.
 * A flow and the view it taps cannot drift apart: rename here and the type checker finds every use.
 * The string values are what the YAML flows spell out, so change them only together with the flows.
 */
export const testIds = {
  screen: {
    home: 'screen-home',
    category: 'screen-category',
    cart: 'screen-cart',
    product: 'screen-product',
    search: 'screen-search',
    account: 'screen-account',
  },
  tab: {
    index: 'tab-home',
    category: 'tab-category',
    cart: 'tab-cart',
    account: 'tab-account',
  },
  tabRow: 'tab-row',
  tabIndicator: 'tab-indicator',
  cartBadge: 'cart-badge',
  langToggle: 'lang-toggle',
  homeBanner: 'home-banner',
  /** Home: the search field, the category rail's "See all", its tiles, and the best-sellers rail. */
  homeSearch: 'home-search',
  homeSeeAll: 'home-see-all',
  homeCategory: (id: string) => `home-category-${id}`,
  homeBestSellers: 'home-best-sellers',
  homeBestSeller: (id: string) => `home-best-seller-${id}`,
  homeQuickAdd: (id: string) => `home-quick-add-${id}`,
  productGrid: 'product-grid',
  /** Grid tiles are numbered by position, so a flow can always tap "the first product". */
  productTile: (index: number) => `product-tile-${index}`,
  /** The heart on a grid tile, numbered like the tile; and the one in the product header. */
  favoriteTile: (index: number) => `favorite-tile-${index}`,
  productFavorite: 'product-favorite',
  /** The Category screen's "Filter & sort" button and the states around its grid. */
  filterButton: 'filter-button',
  categoryState: {
    loading: 'category-loading',
    error: 'category-error',
    empty: 'category-empty',
    reset: 'category-reset',
    nextPageLoading: 'category-next-page-loading',
    nextPageRetry: 'category-next-page-retry',
  },
  addToCart: 'add-to-cart',
  /** The product page: header buttons, its own cart badge, the gallery and its dots, the stepper. */
  productBack: 'product-back',
  productCart: 'product-cart',
  productCartBadge: 'product-cart-badge',
  productGallery: 'product-gallery',
  productDots: 'product-dots',
  productQuantity: 'product-quantity',
  productNotFound: 'product-not-found',
  productNotFoundAction: 'product-not-found-action',
  /** The product page's back gestures (Gesture Handler test ids): body swipe and pull-down. */
  productSwipeBack: 'product-swipe-back',
  productPullBack: 'product-pull-back',
  cartTotal: 'cart-total',
  /** The cart: totals lines, free-delivery line, empty-state button, each row's parts, the undo bar. */
  cartSubtotal: 'cart-subtotal',
  cartVat: 'cart-vat',
  cartFreeDelivery: 'cart-free-delivery',
  cartEmptyCta: 'cart-empty-cta',
  cartRow: (id: string) => `cart-row-${id}`,
  cartRowInfo: (id: string) => `cart-row-info-${id}`,
  cartRowSwipe: (id: string) => `cart-row-swipe-${id}`,
  /** The part of a row that slides (its translateX is what a swipe moves). */
  cartRowContent: (id: string) => `cart-row-content-${id}`,
  cartRowDelete: (id: string) => `cart-row-delete-${id}`,
  cartRowQty: (id: string) => `cart-row-qty-${id}`,
  cartRowTotal: (id: string) => `cart-row-total-${id}`,
  undoBar: 'undo-bar',
  /** UndoBar derives its action's id from the bar's: `${undoBar}-action`. */
  undoAction: 'undo-bar-action',
  /** The filter & sort sheet and its parts (BottomSheet derives the rest from the sheet's own id). */
  filterSheet: 'filter-sheet',
  sheetApply: 'filter-sheet-apply',
  sheetReset: 'filter-sheet-reset',
  search: {
    input: 'search-input',
    back: 'search-back',
    clear: 'search-clear',
    count: 'search-count',
    loading: 'search-loading',
    idle: 'search-idle',
    empty: 'search-empty',
    error: 'search-error',
    result: (id: string) => `search-result-${id}`,
  },
  account: {
    offline: 'account-offline',
    loading: 'account-loading',
    email: 'account-email',
    sendCode: 'account-send-code',
    code: 'account-code',
    verify: 'account-verify',
    changeEmail: 'account-change-email',
    resend: 'account-resend',
    signOut: 'account-sign-out',
    signedIn: 'account-signed-in',
    error: 'account-error',
    favorites: 'account-favorites',
    favorite: (id: string) => `account-favorite-${id}`,
    favoritesEmpty: 'account-favorites-empty',
    backend: 'account-backend',
  },
  checkout: {
    button: 'checkout-button',
    error: 'checkout-error',
    success: 'checkout-success',
  },
  orders: {
    list: 'orders-list',
    loading: 'orders-loading',
    empty: 'orders-empty',
    error: 'orders-error',
    row: (id: string) => `orders-row-${id}`,
  },
} as const;

/** The tab routes, by file name under `app/(tabs)/`. */
export type TabRouteName = keyof typeof testIds.tab;
