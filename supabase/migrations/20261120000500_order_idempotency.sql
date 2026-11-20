-- Idempotent checkout: place_order(lines, request_id).
--
-- The app sends a client uuid per checkout attempt and reuses it when it retries (for example after a
-- network timeout whose request did reach the server). One order per (user, request id): a repeat
-- returns the order already written, in the same jsonb shape, instead of writing a second one.
--
-- Also: each qty must be a JSON number with no fraction before it is cast, so `"2"`, `true` or `1.5`
-- are refused as BAD_QTY instead of being coerced or failing with a cast error.

alter table public.orders add column request_id uuid;

-- Old orders have no request id; nulls never collide in a unique index, so they stay valid.
create unique index orders_user_request_idx on public.orders (user_id, request_id);

drop function if exists public.place_order(jsonb);

create function public.place_order(lines jsonb, request_id uuid)
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
           (6 * gross + 23) / 46,
           gross - (6 * gross + 23) / 46,
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
