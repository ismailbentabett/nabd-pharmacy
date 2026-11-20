-- search_products(query, max_results): bilingual product search, same ranking as the offline
-- `searchCatalog` in src/core/catalog/search.ts.
--
--   * the query is normalised with public.normalize_search and split on spaces into terms
--   * a product matches when EVERY term occurs in its search_text (strpos, so no LIKE escaping)
--   * score = sum over terms of 2 if the term starts a word, else 1
--   * order: score desc, reviews desc, id (byte order, same as the client's id compare)
--
-- 1,000 rows: a sequential scan of one short text column is well under a millisecond, so this
-- deliberately has no trigram index. Add pg_trgm when the catalog grows past ~50k rows.

create or replace function public.search_products(query text, max_results integer default 40)
returns setof public.products
language sql
stable
parallel safe
set search_path = ''
as $$
  with terms as (
    select distinct t as term
    from unnest(string_to_array(public.normalize_search(query), ' ')) as t
    where t <> ''
  ),
  term_count as (
    select count(*) as n from terms
  ),
  scored as (
    select p.id,
           sum(case when strpos(' ' || p.search_text, ' ' || t.term) > 0 then 2 else 1 end) as score,
           count(*) as hits
    from public.products p
    join terms t on strpos(p.search_text, t.term) > 0
    group by p.id
  )
  select p.*
  from scored s
  join public.products p on p.id = s.id
  cross join term_count tc
  where tc.n > 0 and s.hits = tc.n
  order by s.score desc, p.reviews desc, p.id collate "C"
  limit greatest(1, least(coalesce(max_results, 40), 100));
$$;

grant execute on function public.search_products(text, integer) to anon, authenticated;
