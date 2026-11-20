-- Demo people for the Nabd portfolio project: 24 shoppers with favourites and order history.
--
-- Run AFTER the migrations and seed.sql. Safe to run again: it deletes its own demo users first
-- (cascades to profiles, favorites, orders, order_items) and rebuilds them.
--
-- The users are fictional. Their emails use the reserved example.com domain and they have no password,
-- so nobody can sign in as them; they only exist so the dashboard shows realistic data.
-- Everything random is driven by setseed(), so every run produces the same rows.

begin;

delete from auth.users where email like '%@demo.nabd.example.com';

select setseed(0.42);

create temporary table demo_people (n int, id uuid, email text, name text, joined timestamptz) on commit drop;

insert into demo_people (n, id, email, name, joined)
select
  p.n,
  ('00000000-0000-4000-8000-' || lpad(p.n::text, 12, '0'))::uuid,
  p.handle || '@demo.nabd.example.com',
  p.name,
  timestamptz '2026-03-01' + (p.n * interval '6 days 7 hours')
from (values
  (1,  'yacine.benali',       'Yacine Benali'),
  (2,  'amina.bouzid',        'Amina Bouzid'),
  (3,  'karim.haddad',        'Karim Haddad'),
  (4,  'lina.meziane',        'Lina Meziane'),
  (5,  'sofiane.cherif',      'Sofiane Cherif'),
  (6,  'meriem.belkacem',     'Meriem Belkacem'),
  (7,  'rayan.mansouri',      'Rayan Mansouri'),
  (8,  'nourelhouda.saidi',   'Nour El Houda Saidi'),
  (9,  'amine.boudiaf',       'Amine Boudiaf'),
  (10, 'sarah.khelifi',       'Sarah Khelifi'),
  (11, 'walid.aitahmed',      'Walid Ait Ahmed'),
  (12, 'kenza.ouali',         'Kenza Ouali'),
  (13, 'mehdi.larbi',         'Mehdi Larbi'),
  (14, 'imane.hamidi',        'Imane Hamidi'),
  (15, 'bilal.rahmani',       'Bilal Rahmani'),
  (16, 'feriel.toumi',        'Feriel Toumi'),
  (17, 'anis.brahimi',        'Anis Brahimi'),
  (18, 'yasmine.amrani',      'Yasmine Amrani'),
  (19, 'hamza.djebbar',       'Hamza Djebbar'),
  (20, 'rania.ferhat',        'Rania Ferhat'),
  (21, 'samir.ouchene',       'Samir Ouchene'),
  (22, 'lydia.aitali',        'Lydia Ait Ali'),
  (23, 'nadir.kaci',          'Nadir Kaci'),
  (24, 'selma.benaissa',      'Selma Benaissa')
) as p (n, handle, name);

-- auth.users: confirmed, no password (encrypted_password empty), so these accounts cannot log in.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', joined,
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', name, 'demo', true),
  joined, joined, '', '', '', ''
from demo_people;

-- The on_auth_user_created trigger made empty profiles; give them names and the join date.
update public.profiles pr
set display_name = d.name, created_at = d.joined
from demo_people d
where pr.id = d.id;

-- Favourites: 3 to 14 per person, picked across the catalog.
insert into public.favorites (user_id, product_id, created_at)
select d.id, pick.id, d.joined + (random() * interval '120 days')
from demo_people d
cross join lateral (
  select pr.id
  from public.products pr
  where d.n > 0
  order by random()
  limit 3 + floor(random() * 12)::int
) as pick
on conflict do nothing;

-- Orders: 0 to 6 per person, 1 to 5 distinct lines each, quantity 1 to 3.
create temporary table demo_orders (id uuid, user_id uuid, created_at timestamptz, status text) on commit drop;

insert into demo_orders (id, user_id, created_at, status)
select
  gen_random_uuid(),
  d.id,
  least(timestamptz '2026-11-19', d.joined + (random() * interval '200 days')),
  null
from demo_people d
cross join lateral generate_series(1, floor(random() * 7)::int + (d.n * 0)) as g;

-- Older orders are delivered; recent ones are still moving; a few were cancelled.
update demo_orders set status = case
  when random() < 0.06 then 'cancelled'
  when created_at < timestamptz '2026-11-12' then 'delivered'
  when created_at < timestamptz '2026-11-17' then 'preparing'
  else 'placed'
end;

create temporary table demo_lines (order_id uuid, product_id text, name_en text, name_ar text,
  unit_price_h int, qty smallint) on commit drop;

insert into demo_lines
select o.id, pr.id, pr.name_en, pr.name_ar, pr.price_h, (1 + floor(random() * 3))::smallint
from demo_orders o
cross join lateral (
  select p.id, p.name_en, p.name_ar, p.price_h
  from public.products p
  where p.in_stock and o.id is not null
  order by random()
  limit 1 + floor(random() * 5)::int
) as pr;

-- Totals use the app's TVA rule (src/core/money.ts `splitVat`, 19 % included): money is integer centimes
-- (1 DA = 100 centimes); vat = floor((38 * gross + 119) / 238), net = gross - vat. Computed in bigint
-- because 38 * gross overflows integer on large orders.
insert into public.orders (id, user_id, status, gross_h, vat_h, net_h, item_count, created_at)
select o.id, o.user_id, o.status, t.gross,
  ((38 * t.gross::bigint + 119) / 238)::int,
  t.gross - ((38 * t.gross::bigint + 119) / 238)::int,
  t.items, o.created_at
from demo_orders o
join (
  select order_id, sum(unit_price_h * qty)::int as gross, sum(qty)::int as items
  from demo_lines group by order_id
) t on t.order_id = o.id;

insert into public.order_items (order_id, product_id, name_en, name_ar, unit_price_h, qty, line_total_h)
select order_id, product_id, name_en, name_ar, unit_price_h, qty, unit_price_h * qty
from demo_lines;

commit;

select
  (select count(*) from auth.users where email like '%@demo.nabd.example.com') as users,
  (select count(*) from public.favorites f join auth.users u on u.id = f.user_id
     where u.email like '%@demo.nabd.example.com') as favorites,
  (select count(*) from public.orders o join auth.users u on u.id = o.user_id
     where u.email like '%@demo.nabd.example.com') as orders,
  (select count(*) from public.order_items i join public.orders o on o.id = i.order_id
     join auth.users u on u.id = o.user_id where u.email like '%@demo.nabd.example.com') as order_items;
