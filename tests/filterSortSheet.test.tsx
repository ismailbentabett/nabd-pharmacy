/**
 * The Category filter & sort sheet's contents (C-03, G-08): choices, Apply and the result count,
 * the draft rules (thrown away on close, restarted when the screen's value moves under it), and
 * Arabic. The sheet's motion and gestures are in bottomSheet.test.tsx and bottomSheetDrag.test.tsx;
 * the stale-draft bug end to end on the Category screen is in categorySheetFlow.test.tsx.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/core/catalog';
import { FilterSortSheet } from '@/features/category/FilterSortSheet';
import { NO_FILTERS, type FilterSortValue } from '@/features/category/filterSortValue';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { testIds } from '@/testIds';

import { METRICS, noop } from './helpers/category';
import { pressNative, renderWithProviders } from './helpers/render';
import { keepSharedValues } from './helpers/sharedValues';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  keepSharedValues();
});

afterEach(() => {
  jest.restoreAllMocks();
});

type FiltersProps = { open: boolean; onApply: (next: FilterSortValue) => void; onClose?: () => void; value?: FilterSortValue };

function Filters({ open, onApply, onClose = noop, value = NO_FILTERS }: FiltersProps) {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={METRICS}>
        <FilterSortSheet open={open} value={value} onApply={onApply} onClose={onClose} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

async function choose(role: 'button' | 'checkbox' | 'switch', name: string) {
  await fireEvent(screen.getByRole(role, { name }), 'buttonPress', { nativeEvent: {} });
}

const vitamins = CATEGORIES.find((category) => category.id === 'vitamins');
if (!vitamins) throw new Error('The catalogue has no vitamins');

describe('FilterSortSheet', () => {
  it('applies the chosen sort and filters; closing is left to the parent, so Close is not reported too', async () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    await renderWithProviders(<Filters open onApply={onApply} onClose={onClose} />);

    await choose('button', 'Price: low to high');
    await choose('checkbox', vitamins.en);
    await choose('switch', 'In stock only');
    expect(screen.getByRole('button', { name: 'Price: low to high', selected: true })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: vitamins.en, checked: true })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'In stock only', checked: true })).toBeTruthy();

    await pressNative(testIds.sheetApply);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({ sort: 'priceAsc', filters: { categories: ['vitamins'], inStockOnly: true } });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('names the result count on Apply and keeps it while the sheet slides away', async () => {
    const { rerender } = await renderWithProviders(<Filters open onApply={noop} />);
    await choose('switch', 'In stock only');
    const label: unknown = screen.getByTestId(testIds.sheetApply).props.accessibilityLabel;
    expect(label).toMatch(/^Show [\d,]+ results$/);

    await rerender(<Filters open={false} onApply={noop} />);
    expect(screen.getByTestId(testIds.sheetApply, { includeHiddenElements: true }).props.accessibilityLabel).toBe(label);
  });

  it('closing without Apply throws the edits away: the next open starts from what the grid shows', async () => {
    const onApply = jest.fn();
    const { rerender } = await renderWithProviders(<Filters open onApply={onApply} />);
    await choose('button', 'Top rated');
    expect(screen.getByRole('button', { name: 'Top rated', selected: true })).toBeTruthy();

    await rerender(<Filters open={false} onApply={onApply} />);
    await rerender(<Filters open onApply={onApply} />);
    expect(screen.getByRole('button', { name: 'Relevance', selected: true })).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('keeps the draft through an unrelated re-render, and restarts it when the value changes while open', async () => {
    const onApply = jest.fn();
    const { rerender } = await renderWithProviders(<Filters open onApply={onApply} />);
    await choose('button', 'Top rated');

    // Same value, new render (e.g. the parent re-rendered): the edit stays.
    await rerender(<Filters open onApply={onApply} />);
    expect(screen.getByRole('button', { name: 'Top rated', selected: true })).toBeTruthy();

    // Home picked Vitamins under the open sheet: the draft follows, so Apply cannot drop it.
    const fromHome: FilterSortValue = { sort: 'relevance', filters: { categories: ['vitamins'] } };
    await rerender(<Filters open onApply={onApply} value={fromHome} />);
    expect(screen.getByRole('checkbox', { name: vitamins.en, checked: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Relevance', selected: true })).toBeTruthy();

    await pressNative(testIds.sheetApply);
    expect(onApply).toHaveBeenCalledWith(fromHome);
  });

  it('in Arabic, every label, choice and the result count is Arabic', async () => {
    const onApply = jest.fn();
    await renderWithProviders(<Filters open onApply={onApply} />, { lang: 'ar' });

    expect(screen.getByRole('header', { name: 'تصفية وترتيب' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'ترتيب حسب' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'الأكثر صلة', selected: true })).toBeTruthy();
    for (const category of CATEGORIES) expect(screen.getByRole('checkbox', { name: category.ar })).toBeTruthy();
    expect(screen.getByTestId(testIds.sheetApply).props.accessibilityLabel).toBe('عرض 1,000 نتيجة');
    expect(screen.queryByText('Sort by')).toBeNull();

    await choose('checkbox', vitamins.ar);
    await choose('switch', 'المتوفر فقط');
    await pressNative(testIds.sheetApply);
    expect(onApply).toHaveBeenCalledWith({ sort: 'relevance', filters: { categories: ['vitamins'], inStockOnly: true } });
  });
});
