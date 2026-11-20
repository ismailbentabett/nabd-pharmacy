-- Nabd schema. Money is stored as integer halalas (1 SAR = 100 halalas), VAT included, exactly like
-- the client (src/core/money.ts). No floats ever touch a price column.
--
-- Catalog tables (categories, products, banners) are filled by supabase/seed.sql, which is generated
-- from the same seeded catalog as the offline fake API, so both backends return identical products.

-- ---------------------------------------------------------------------------------------------------
-- Search normalisation. Mirrored in TypeScript by `normalizeSearch` (src/core/catalog/search.ts); the
-- two must agree, and tests/search.test.ts pins the TS side with the same cases.
--   1. lower-case
--   2. strip Arabic diacritics (tashkeel U+064B..U+065F, superscript alef U+0670) and tatweel U+0640
--   3. fold alef variants (أ إ آ ٱ) to ا, alef maqsura ى to ي, taa marbuta ة to ه
--   4. collapse punctuation and runs of whitespace to one space, trim
-- ---------------------------------------------------------------------------------------------------
create or replace function public.normalize_search(input text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      translate(
        regexp_replace(lower(coalesce(input, '')), E'[\u064B-\u065F\u0670\u0640]', '', 'g'),
        'أإآٱىة',
        'اااايه'
      ),
      '[-_.,/+()&%''"!?:;[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

-- ---------------------------------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------------------------------
create table public.categories (
  id           text primary key,
  name_en      text not null,
  name_ar      text not null,
  icon         text not null,
  price_min_h  integer not null check (price_min_h > 0),
  price_max_h  integer not null check (price_max_h >= price_min_h),
  sort         smallint not null
);

create table public.products (
  id               text primary key,
  sku              text not null unique,
  name_en          text not null,
  name_ar          text not null,
  brand_en         text not null,
  brand_ar         text not null,
  category_id      text not null references public.categories (id),
  price_h          integer not null check (price_h > 0),
  old_price_h      integer check (old_price_h is null or old_price_h > price_h),
  -- Computed by the seed with the client's own `discountPercent`, so sorting by discount gives the
  -- exact same order on both backends (a SQL re-implementation could round differently).
  discount_pct     smallint not null default 0 check (discount_pct between 0 and 100),
  rating           numeric(2, 1) not null check (rating between 0 and 5),
  reviews          integer not null check (reviews >= 0),
  in_stock         boolean not null,
  images           text[] not null check (cardinality(images) between 1 and 10),
  description_en   text not null,
  description_ar   text not null,
  dominant_color   text not null check (dominant_color ~ '^#[0-9A-Fa-f]{6}$'),
  -- 1..12 for the Home "Best sellers" rail (same pick as `pickBestSellers`), null otherwise.
  best_seller_rank smallint unique check (best_seller_rank > 0),
  search_text      text generated always as (
                     public.normalize_search(name_en || ' ' || brand_en || ' ' || name_ar || ' ' || brand_ar)
                   ) stored
);

-- The grid always pages in `id` order inside a sort key, so every index ends with id.
create index products_category_idx on public.products (category_id, id);
create index products_price_idx    on public.products (price_h, id);
create index products_rating_idx   on public.products (rating desc, reviews desc, id);
create index products_discount_idx on public.products (discount_pct desc, id);

create table public.banners (
  id           text primary key,
  title_en     text not null,
  sub_en       text not null,
  cta_en       text not null,
  title_ar     text not null,
  sub_ar       text not null,
  cta_ar       text not null,
  category_id  text references public.categories (id),
  tint         text not null check (tint in ('primary', 'secondary')),
  sort         smallint not null
);

-- ---------------------------------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  created_at   timestamptz not null default now()
);

-- A profile row appears the moment someone signs up (email one-time code).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.favorites (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id  text not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------------------------------------------
-- Orders. Written only by public.place_order (see the place_order migration); clients can read their
-- own rows but have no insert/update/delete policy at all.
-- ---------------------------------------------------------------------------------------------------
create table public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'placed'
              check (status in ('placed', 'preparing', 'delivered', 'cancelled')),
  gross_h     integer not null check (gross_h > 0),
  vat_h       integer not null check (vat_h >= 0),
  net_h       integer not null check (net_h > 0),
  item_count  integer not null check (item_count > 0),
  created_at  timestamptz not null default now(),
  constraint orders_vat_adds_up check (net_h + vat_h = gross_h)
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);

create table public.order_items (
  order_id      uuid not null references public.orders (id) on delete cascade,
  product_id    text not null references public.products (id),
  -- Snapshots: the order shows what was bought at that price, even if the catalog changes later.
  name_en       text not null,
  name_ar       text not null,
  unit_price_h  integer not null check (unit_price_h > 0),
  qty           smallint not null check (qty between 1 and 99),
  line_total_h  integer not null,
  primary key (order_id, product_id),
  constraint order_items_line_adds_up check (line_total_h = unit_price_h * qty)
);
