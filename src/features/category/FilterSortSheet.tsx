/**
 * The Category screen's filter & sort sheet (C-03). How it works:
 *
 * - The sheet edits a draft, not the grid. Every open starts the draft from `value` (what the grid
 *   shows), so closing without Apply throws the edits away and the grid never refetches mid-edit.
 *   If `value` changes while the sheet is open (Home picked a category under it), the draft starts
 *   again from the new value, so Apply can never write back a value the screen has moved past.
 * - Apply hands the draft to `onApply`, and the parent closes the sheet by setting `open` to false
 *   (so the sheet never reports Close as well). Reset clears the draft only; Apply commits it.
 * - The Apply button names the result ("Show 312 results"). Offline the count is synchronous, so it
 *   is right on the same frame as the tap; on Supabase it is one cached head request per filter set
 *   (useProductCount), and the last number stays up until the new one lands.
 * - Every choice is a 48 dp target, buzzes once (haptics.tap) when it changes something, and tells
 *   screen readers its state: single choices are "selected", categories are checkboxes, stock is a
 *   switch.
 *
 * Motion lives in BottomSheet; nothing here animates, so reduced motion needs nothing extra.
 * RTL (G-08): rows and chips use logical order (label at the start, control at the end) and the
 * switch thumb sits at the end when on, so all of it mirrors without a single `dir` check.
 * The value's rules (bands, toggles, Reset) live in filterSortValue.ts.
 */
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { SORT_KEYS, type ProductFilters, type SortKey } from '@/core/api/fakeApi';
import { CATEGORIES } from '@/core/catalog';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { control, radius, size, space } from '@/design/tokens';
import { formatCount } from '@/i18n/format';
import type { MessageKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { haptics } from '@/motion/haptics';
import { testIds } from '@/testIds';
import { BottomSheet } from '@/ui/BottomSheet';
import { StateButton } from '@/ui/StateButton';

import { isPriceBand, NO_FILTERS, PRICE_BANDS, priceFilters, RATING_STEPS, toggleCategory, type FilterSortValue, type PriceBand } from './filterSortValue';
import { useProductCount } from './useProductCount';

export type FilterSortSheetProps = {
  open: boolean;
  value: FilterSortValue;
  /** The parent commits `next` and closes the sheet (sets `open` to false). */
  onApply: (next: FilterSortValue) => void;
  onClose: () => void;
};

const SORT_LABEL: Readonly<Record<SortKey, MessageKey>> = {
  relevance: 'sort.relevance',
  priceAsc: 'sort.priceAsc',
  priceDesc: 'sort.priceDesc',
  rating: 'sort.rating',
  discount: 'sort.discount',
};

/** PressableScale has no `radio` role, so one-of-many choices are buttons read as "selected". */
const SINGLE_CHOICE_ROLE = 'button';

export function FilterSortSheet({ open, value, onApply, onClose }: FilterSortSheetProps) {
  const styles = useStyles();
  const { t, tn, lang } = useT();
  const [draft, setDraft] = useState(value);
  // Restart the draft on every open, and whenever `value` changes while open (state adjusted during
  // render, so the first frame is right). A change while closed waits for the next open.
  const [seen, setSeen] = useState({ open, value });
  if (open !== seen.open || value !== seen.value) {
    setSeen({ open, value });
    if (open) setDraft(value);
  }
  const { sort, filters } = draft;
  // Counted while closed too: the sheet is still on screen as it slides away after Apply, and a
  // label that flipped to "No results" on the way down would be a lie. The count is cached per query.
  const count = useProductCount(filters);

  const choose = (next: FilterSortValue) => {
    haptics.tap();
    setDraft(next);
  };
  const patch = (change: Partial<ProductFilters>) => choose({ sort, filters: { ...filters, ...change } });

  const priceLabel = (band: PriceBand | null) => {
    if (band === null) return t('sheet.any');
    const min = formatCount((band.from ?? 0) / 100);
    const max = formatCount((band.to ?? 0) / 100);
    if (band.from === undefined) return t('sheet.priceUnder', { max });
    if (band.to === undefined) return t('sheet.priceOver', { min });
    return t('sheet.priceBetween', { min, max });
  };

  const apply = () => {
    haptics.confirm();
    onApply(draft);
  };

  const footer = (
    <>
      <View style={styles.reset}>
        <StateButton kind="secondary" label={t('category.reset')} onPress={() => choose(NO_FILTERS)} testID={testIds.sheetReset} />
      </View>
      <View style={styles.apply}>
        <StateButton kind="primary" label={count === null ? t('sheet.showResults') : tn('category.apply', count)} onPress={apply} testID={testIds.sheetApply} />
      </View>
    </>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={t('category.filter')} accessibilityLabel={t('category.filter')} footer={footer} testID={testIds.filterSheet}>
      <Section title={t('sheet.sort')}>
        {SORT_KEYS.map((key) => (
          <Choice key={key} kind="row" label={t(SORT_LABEL[key])} on={key === sort} onPress={() => key !== sort && choose({ sort: key, filters })} />
        ))}
      </Section>
      <Section title={t('sheet.categories')}>
        <View style={styles.chips}>
          {CATEGORIES.map((category) => (
            <Choice
              key={category.id}
              kind="checkbox"
              label={category[lang]}
              on={filters.categories?.includes(category.id) === true}
              onPress={() => patch({ categories: toggleCategory(filters.categories, category.id) })}
            />
          ))}
        </View>
      </Section>
      <View style={styles.section}>
        <Choice kind="switch" label={t('sheet.inStock')} on={filters.inStockOnly === true} onPress={() => patch({ inStockOnly: !filters.inStockOnly })} />
      </View>
      <Section title={t('sheet.minRating')}>
        <View style={styles.chips}>
          {[undefined, ...RATING_STEPS].map((r) => (
            <Choice
              key={r ?? 'any'}
              kind="chip"
              label={r === undefined ? t('sheet.any') : t('sheet.ratingAtLeast', { r })}
              on={filters.minRating === r}
              onPress={() => filters.minRating !== r && patch({ minRating: r })}
            />
          ))}
        </View>
      </Section>
      <Section title={t('sheet.price')}>
        <View style={styles.chips}>
          {[null, ...PRICE_BANDS].map((band) => (
            <Choice key={band ? `${band.from ?? 0}-${band.to ?? 'up'}` : 'any'} kind="chip" label={priceLabel(band)} on={isPriceBand(filters, band)} onPress={() => !isPriceBand(filters, band) && patch(priceFilters(band))} />
          ))}
        </View>
      </Section>
    </BottomSheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text variant="label" weight="semibold" tone="muted" accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

type ChoiceProps = { kind: 'row' | 'chip' | 'checkbox' | 'switch'; label: string; on: boolean; onPress: () => void };

/** One selectable thing. Rows and the switch span the width; chips wrap. */
function Choice({ kind, label, on, onPress }: ChoiceProps) {
  const styles = useStyles();
  const many = kind === 'checkbox' || kind === 'switch';
  const chip = kind === 'chip' || kind === 'checkbox';
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole={kind === 'switch' ? 'switch' : kind === 'checkbox' ? 'checkbox' : SINGLE_CHOICE_ROLE}
      accessibilityState={many ? { checked: on } : { selected: on }}
      shrinkOnPress={chip}
      style={chip ? styles.chipTarget : styles.row}
    >
      {chip ? (
        <View style={[styles.chip, on && styles.chipOn]}>
          <Text variant="label" style={on && styles.chipTextOn}>{label}</Text>
        </View>
      ) : (
        <>
          <Text weight={on ? 'medium' : 'regular'} style={styles.rowLabel}>
            {label}
          </Text>
          {kind === 'switch' ? (
            <View style={[styles.track, on && styles.trackOn]}>
              <View style={styles.thumb} />
            </View>
          ) : (
            <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
          )}
        </>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  section: { paddingTop: space.md },
  sectionTitle: { paddingBottom: space.xxs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xs },
  // The touch target is `size.touch` (48 dp, PressableScale's floor); the visible pill inside it is shorter.
  chipTarget: { justifyContent: 'center' },
  chip: { minHeight: control.chipHeight, justifyContent: 'center', paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: size.hairline, borderColor: c.lineStrong, backgroundColor: c.bgSurface },
  // Selected = inverted: text colour becomes the fill, so it reads in light and dark mode alike.
  chipOn: { backgroundColor: c.textPrimary, borderColor: c.textPrimary },
  chipTextOn: { color: c.bgSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowLabel: { flex: 1 },
  radio: { width: control.radio, height: control.radio, borderRadius: radius.pill, borderWidth: control.border, borderColor: c.controlOutline, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: c.textPrimary },
  radioDot: { width: control.radioDot, height: control.radioDot, borderRadius: radius.pill, backgroundColor: c.textPrimary },
  track: { width: control.switchWidth, height: control.switchHeight, padding: control.switchInset, borderRadius: radius.pill, backgroundColor: c.controlOutline, alignItems: 'flex-start' },
  trackOn: { backgroundColor: c.textPrimary, alignItems: 'flex-end' },
  thumb: { width: control.switchThumb, height: control.switchThumb, borderRadius: radius.pill, backgroundColor: c.bgSurface },
  reset: { flex: 1 },
  apply: { flex: 2 },
}));
