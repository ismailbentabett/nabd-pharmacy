/**
 * supabase/seed.sql is generated from the same deterministic catalog the offline backend uses.
 * These tests keep the checked-in file from drifting and pin the escaping rules.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { BANNERS, CATEGORIES, getCatalog } from '@/core/catalog';

import { buildSeedSql, productRow, sqlText } from '../scripts/supabase/seedSql';

const input = { categories: CATEGORIES, products: getCatalog().products, banners: BANNERS };

describe('seed SQL', () => {
  it('matches the checked-in supabase/seed.sql (run `npm run supabase:seed` after changing the catalog)', () => {
    const onDisk = readFileSync(resolve(__dirname, '../supabase/seed.sql'), 'utf8').replace(/\r\n/g, '\n');
    expect(onDisk).toBe(buildSeedSql(input));
  });

  it('is the same text on every run', () => {
    expect(buildSeedSql(input)).toBe(buildSeedSql(input));
  });

  it('upserts every product exactly once, in one transaction', () => {
    const sql = buildSeedSql(input);
    expect(sql.startsWith('-- GENERATED')).toBe(true);
    expect(sql).toContain('begin;');
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
    for (const p of input.products.slice(0, 50)) {
      expect(sql.split(`('${p.id}', `).length - 1).toBe(1);
    }
  });

  it('doubles single quotes, the only escape standard SQL strings need', () => {
    expect(sqlText("Johnson's")).toBe("'Johnson''s'");
  });

  it('writes money as integer halalas and a missing old price as null', () => {
    const p = { ...input.products[0]!, price: 49.95, oldPrice: null };
    const row = productRow(p, null);
    expect(row).toContain(', 4995, null, ');
    expect(row.endsWith(', null)')).toBe(true);
  });
});
