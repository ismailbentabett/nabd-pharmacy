-- place_order(lines): the only way an order is written.
--
-- The client sends product ids and quantities, never prices. Every line is repriced from
-- public.products inside one transaction, so a tampered client cannot change what it pays.
-- VAT uses the same integer formula as src/core/money.ts `splitVat`:
--   vat = floor((6 * gross + 23) / 46)      -- the 15/115 share, rounded half up, no floats
--   net = gross - vat
--
-- Input:  [{"product_id": "p-0001", "qty": 2}, ...]   (1..50 lines, qty 1..99, no duplicate ids)
-- Output: {"id", "created_at", "status", "gross_h", "vat_h", "net_h", "item_count"}
--
-- Errors use SQLSTATE 22023 (invalid_parameter_value) with a stable message prefix the client maps
-- to copy: EMPTY_ORDER, TOO_MANY_LINES, BAD_QTY, DUPLICATE_LINE, UNKNOWN_PRODUCT, OUT_OF_STOCK,
-- and 28000 NOT_SIGNED_IN.

create or replace function public.place_order(lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid         uuid := auth.uid();
  line_count  integer;
  new_order   public.orders%rowtype;
  bad_id      text;
begin
  if uid is null then
    raise exception 'NOT_SIGNED_IN' using errcode = '28000';
  end if;

  if lines is null or jsonb_typeof(lines) <> 'array' or jsonb_array_length(lines) = 0 then
    raise exception 'EMPTY_ORDER' using errcode = '22023';
  end if;

  line_count := jsonb_array_length(lines);
  if line_count > 50 then
    raise exception 'TOO_MANY_LINES' using errcode = '22023';
  end if;

  -- Parse once into a temp table so every check below reads typed columns.
  create temporary table _lines on commit drop as
    select (l ->> 'product_id')::text as product_id,
           (l ->> 'qty')::integer      as qty
    from jsonb_array_elements(lines) as l;

  if exists (select 1 from _lines where product_id is null or qty is null or qty < 1 or qty > 99) then
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

  with priced as (
    select sum(p.price_h * l.qty)::integer as gross, sum(l.qty)::integer as items
    from _lines l join public.products p on p.id = l.product_id
  )
  insert into public.orders (user_id, gross_h, vat_h, net_h, item_count)
  select uid,
         gross,
         (6 * gross + 23) / 46,
         gross - (6 * gross + 23) / 46,
         items
  from priced
  returning * into new_order;

  insert into public.order_items (order_id, product_id, name_en, name_ar, unit_price_h, qty, line_total_h)
  select new_order.id, p.id, p.name_en, p.name_ar, p.price_h, l.qty, p.price_h * l.qty
  from _lines l join public.products p on p.id = l.product_id;

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

revoke execute on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;
