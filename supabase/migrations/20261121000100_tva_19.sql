-- Algeria: TVA 19 %, money in integer centimes (1 DA = 100 centimes).
--
-- Column names keep their `_h` suffix (from the earlier halala design) so no client query changes;
-- the comments below record what they now hold.
--
-- place_order is redefined with the 19 % share. It is the idempotent (lines, request_id) version from
-- 20261120000500_order_idempotency.sql, unchanged except for the TVA line. Same formula as
-- src/core/money.ts `splitVat`:
--   vat = floor((38 * gross + 119) / 238)   -- the 19/119 share, rounded half up, no floats
--   (computed in bigint: 38 * gross overflows integer above ~565,000 DA)
--   net = gross - vat

comment on column public.categories.price_min_h is 'Integer centimes (1 DA = 100 centimes), TVA included.';
comment on column public.categories.price_max_h is 'Integer centimes (1 DA = 100 centimes), TVA included.';
comment on column public.products.price_h is 'Integer centimes (1 DA = 100 centimes), TVA included.';
comment on column public.products.old_price_h is 'Integer centimes (1 DA = 100 centimes), TVA included; null when not discounted.';
comment on column public.orders.gross_h is 'Order total in integer centimes (1 DA = 100 centimes), TVA included.';
comment on column public.orders.vat_h is 'TVA share (19/119 of gross, rounded half up) in integer centimes.';
comment on column public.orders.net_h is 'gross_h - vat_h, in integer centimes.';
comment on column public.order_items.unit_price_h is 'Unit price at order time, integer centimes (1 DA = 100 centimes), TVA included.';
comment on column public.order_items.line_total_h is 'unit_price_h * qty, integer centimes (1 DA = 100 centimes).';

create or replace function public.place_order(lines jsonb, request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
-- The parameter `request_id` has the same name as the column. Unqualified names mean the column
-- (needed for `on conflict (user_id, request_id)`); the parameter is always written
-- `place_order.request_id`.
declare
  uid         uuid := auth.uid();
  line_count  integer;
  new_order   public.orders%rowtype;
  bad_id      text;
begin
  if uid is null then
    raise exception 'NOT_SIGNED_IN' using errcode = '28000';
  end if;

  if place_order.request_id is null then
    raise exception 'MISSING_REQUEST_ID' using errcode = '22023';
  end if;

  -- A retry: answer with the order this request already made. Checked before validation, so the
  -- answer does not change if stock or prices moved since the first attempt.
  select o.* into new_order
  from public.orders o
  where o.user_id = uid and o.request_id = place_order.request_id;

  if not found then
    if lines is null or jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0 then
      raise exception 'EMPTY_ORDER' using errcode = '22023';
    end if;

    line_count := jsonb_array_length(lines);
    if line_count > 50 then
      raise exception 'TOO_MANY_LINES' using errcode = '22023';
    end if;

    -- Type check before any cast. The CASE makes the order explicit: the numeric casts only run on
    -- values already known to be JSON numbers (a WHERE with OR gives no such guarantee).
    if exists (
      select 1
      from jsonb_array_elements(lines) as l
      where case
              when jsonb_typeof(l -> 'qty') = 'number'
                then (l ->> 'qty')::numeric not between 1 and 99 or (l ->> 'qty')::numeric % 1 <> 0
              else true
            end
    ) then
      raise exception 'BAD_QTY' using errcode = '22023';
    end if;

    -- Parse once into a temp table so every check below reads typed columns.
    create temporary table _lines on commit drop as
      select (l ->> 'product_id')::text as product_id,
             (l ->> 'qty')::integer      as qty
      from jsonb_array_elements(lines) as l;

    if exists (select 1 from _lines where product_id is null) then
      raise exception 'BAD_QTY' using errcode = '22023';
    end if;

    if (select count(distinct product_id) from _lines) <> line_count then
      raise exception 'DUPLICATE_LINE' using errcode = '22023';
    end if;

    select l.product_id into bad_id
    from _lines l left join public.products p on p.id = l.product_id
    where p.id is null
    limit 1;
    if bad_id is not null then
      raise exception 'UNKNOWN_PRODUCT %', bad_id using errcode = '22023';
    end if;

    select l.product_id into bad_id
    from _lines l join public.products p on p.id = l.product_id
    where not p.in_stock
    limit 1;
    if bad_id is not null then
      raise exception 'OUT_OF_STOCK %', bad_id using errcode = '22023';
    end if;

    -- Two identical requests at the same moment: the second waits on the unique index, then does
    -- nothing, and reads the first one's order below.
    with priced as (
      select sum(p.price_h * l.qty)::integer as gross, sum(l.qty)::integer as items
      from _lines l join public.products p on p.id = l.product_id
    )
    insert into public.orders (user_id, request_id, gross_h, vat_h, net_h, item_count)
    select uid,
           place_order.request_id,
           gross,
           ((38 * gross::bigint + 119) / 238)::integer,
           gross - ((38 * gross::bigint + 119) / 238)::integer,
           items
    from priced
    on conflict (user_id, request_id) do nothing
    returning * into new_order;

    if found then
      insert into public.order_items (order_id, product_id, name_en, name_ar, unit_price_h, qty, line_total_h)
      select new_order.id, p.id, p.name_en, p.name_ar, p.price_h, l.qty, p.price_h * l.qty
      from _lines l join public.products p on p.id = l.product_id;
    else
      select o.* into strict new_order
      from public.orders o
      where o.user_id = uid and o.request_id = place_order.request_id;
    end if;
  end if;

  return jsonb_build_object(
    'id',         new_order.id,
    'created_at', new_order.created_at,
    'status',     new_order.status,
    'gross_h',    new_order.gross_h,
    'vat_h',      new_order.vat_h,
    'net_h',      new_order.net_h,
    'item_count', new_order.item_count
  );
end;
$$;

revoke execute on function public.place_order(jsonb, uuid) from public, anon;
grant execute on function public.place_order(jsonb, uuid) to authenticated;
