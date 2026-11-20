/**
 * Writes supabase/seed.sql from the deterministic catalog.
 *
 *   npm run supabase:seed
 *
 * The Supabase CLI runs supabase/seed.sql after the migrations on `supabase db reset`; on a hosted
 * project, paste it into the SQL editor once (see README → "Use a real Supabase backend").
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { BANNERS, CATEGORIES, getCatalog } from '../../src/core/catalog';
import { buildSeedSql } from './seedSql';

const target = resolve(__dirname, '../../supabase/seed.sql');
const sql = buildSeedSql({
  categories: CATEGORIES,
  products: getCatalog().products,
  banners: BANNERS,
});

writeFileSync(target, sql, 'utf8');
process.stdout.write(`wrote ${target} (${(sql.length / 1024).toFixed(0)} KiB)\n`);
