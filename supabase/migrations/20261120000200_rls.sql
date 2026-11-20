-- Row Level Security. The app ships only the anon key, so these policies ARE the security boundary.
--
--   catalog (categories, products, banners)  read for everyone, no writes from clients
--   profiles                                 read + update your own row
--   favorites                                read, add, remove your own rows
--   orders, order_items                      read your own rows; writes only via place_order()
--
-- `(select auth.uid())` instead of `auth.uid()` lets Postgres evaluate it once per statement instead
-- of once per row (Supabase RLS performance guidance).

alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.banners     enable row level security;
alter table public.profiles    enable row level security;
alter table public.favorites   enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Catalog ------------------------------------------------------------------------------------------
create policy "catalog is public: categories" on public.categories
  for select to anon, authenticated using (true);

create policy "catalog is public: products" on public.products
  for select to anon, authenticated using (true);

create policy "catalog is public: banners" on public.banners
  for select to anon, authenticated using (true);

-- Profiles -----------------------------------------------------------------------------------------
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Favorites ----------------------------------------------------------------------------------------
create policy "read own favorites" on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));

create policy "add own favorites" on public.favorites
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "remove own favorites" on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- Orders -------------------------------------------------------------------------------------------
create policy "read own orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));

create policy "read own order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = (select auth.uid())
    )
  );

-- Least privilege on top of RLS: clients never need to write the catalog or orders directly.
revoke insert, update, delete on public.categories, public.products, public.banners from anon, authenticated;
revoke insert, update, delete on public.orders, public.order_items from anon, authenticated;
revoke insert, update, delete on public.favorites, public.profiles from anon;
revoke update on public.favorites from authenticated;
