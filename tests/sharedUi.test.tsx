/**
 * The shared building blocks every screen uses: product image, price, page dots and the quantity
 * stepper. These tests pin the contracts the screens rely on (sizes requested, what TalkBack hears,
 * which handler a press reaches), not pixels.
 */
import { screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet, type ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { imageBucket } from '@/core/catalog';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { DOT_STEP, PageDots } from '@/ui/PageDots';
import { PriceBlock } from '@/ui/PriceBlock';
import { ProductImage, productImageUri } from '@/ui/ProductImage';
import { QuantityStepper } from '@/ui/QuantityStepper';

import { pressNative, renderWithProviders } from './helpers/render';

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
});

describe('productImageUri', () => {
  it('asks picsum for the bucket that fits the tile, never the 800 px original (D-06, F-06)', () => {
    const uri = productImageUri('p-0001', 1, 170);
    const bucket = imageBucket(170, PixelRatio.get());
    expect(bucket).toBeLessThan(800);
    expect(uri).toBe(`https://picsum.photos/seed/p-0001-1/${bucket}/${bucket}`);
  });

  it('gives the same uri for the same product, image and size, so the cache always hits', () => {
    expect(productImageUri('p-0042', 2, 170)).toBe(productImageUri('p-0042', 2, 170));
    expect(productImageUri('p-0042', 2, 170)).not.toBe(productImageUri('p-0042', 3, 170));
  });
});

describe('ProductImage', () => {
  it('renders on its placeholder colour with the recycling key set to its uri', async () => {
    await renderWithProviders(
      <ProductImage testID="img" productId="p-0001" displaySize={170} placeholderColor="#ABCDEF" />,
    );
    const image = screen.getByTestId('img');
    const style = StyleSheet.flatten(image.props.style) as ViewStyle;
    expect(style.backgroundColor).toBe('#ABCDEF');
    expect(image.props.recyclingKey).toBe(productImageUri('p-0001', 1, 170));
  });
});

describe('PriceBlock', () => {
  it('reads the current and the old price as one sentence when there is a discount', async () => {
    await renderWithProviders(<PriceBlock testID="price" price={49.95} oldPrice={59.95} size="tile" />);
    expect(screen.getByTestId('price').props.accessibilityLabel).toBe('49.95 DA, was 59.95 DA');
    expect(screen.getByText('59.95 DA')).toBeTruthy();
  });

  it('shows no old price when it is missing or not higher than the current price', async () => {
    const { rerender } = await renderWithProviders(
      <PriceBlock testID="price" price={49.95} oldPrice={null} size="tile" />,
    );
    expect(screen.getByTestId('price').props.accessibilityLabel).toBe('49.95 DA');
    await rerender(<PriceBlock testID="price" price={49.95} oldPrice={49.95} size="hero" />);
    expect(screen.getAllByText(/49\.95/)).toHaveLength(1);
  });

  it('uses the Arabic currency label in Arabic', async () => {
    await renderWithProviders(<PriceBlock testID="price" price={10} oldPrice={null} size="tile" />, { lang: 'ar' });
    expect(screen.getByTestId('price').props.accessibilityLabel).toBe('10.00 د.ج');
  });
});

function Dots({ count, page }: { count: number; page: number }) {
  const progress = useSharedValue(page);
  return <PageDots testID="dots" count={count} progress={progress} />;
}

/** The dots are hidden from TalkBack on purpose, so the query has to opt in to hidden elements. */
function pillTransform() {
  const pill = screen.getByTestId('dots-pill', { includeHiddenElements: true });
  return (StyleSheet.flatten(pill.props.style) as ViewStyle).transform;
}

describe('PageDots', () => {
  it('draws nothing for a single page', async () => {
    await renderWithProviders(<Dots count={1} page={0} />);
    expect(screen.queryByTestId('dots')).toBeNull();
  });

  it('moves the pill one dot step per page, towards the reading end in both directions', async () => {
    const ltr = await renderWithProviders(<Dots count={5} page={2} />);
    expect(pillTransform()).toEqual([{ translateX: 2 * DOT_STEP }]);
    await ltr.unmount();

    await renderWithProviders(<Dots count={5} page={2} />, { lang: 'ar' });
    expect(pillTransform()).toEqual([{ translateX: -2 * DOT_STEP }]);
  });

  it('keeps the pill on the last dot when the gallery rubber-bands past the end', async () => {
    await renderWithProviders(<Dots count={3} page={3.4} />);
    expect(pillTransform()).toEqual([{ translateX: 2 * DOT_STEP }]);
  });
});

describe('QuantityStepper', () => {
  const handlers = () => ({ onIncrement: jest.fn(), onDecrement: jest.fn() });

  it('steps up and down and is announced as an adjustable "Quantity"', async () => {
    const h = handlers();
    await renderWithProviders(<QuantityStepper testID="qty" value={2} {...h} />);
    await pressNative('qty-increment');
    await pressNative('qty-decrement');
    expect(h.onIncrement).toHaveBeenCalledTimes(1);
    expect(h.onDecrement).toHaveBeenCalledTimes(1);
    const root = screen.getByTestId('qty');
    expect(root.props.accessibilityRole).toBe('adjustable');
    expect(root.props.accessibilityLabel).toBe('Quantity');
    expect(root.props.accessibilityValue).toMatchObject({ min: 1, max: 99, now: 2 });
  });

  it('does not go below the minimum when there is no remove action', async () => {
    const h = handlers();
    await renderWithProviders(<QuantityStepper testID="qty" value={1} {...h} />);
    await pressNative('qty-decrement');
    expect(h.onDecrement).not.toHaveBeenCalled();
  });

  it('turns minus into remove at the minimum when the caller allows it (cart lines)', async () => {
    const h = handlers();
    const onRemove = jest.fn();
    await renderWithProviders(
      <QuantityStepper testID="qty" value={1} {...h} onRemove={onRemove} removeLabel="Remove Vitamin C" />,
    );
    expect(screen.getByTestId('qty-decrement').props.accessibilityLabel).toBe('Remove Vitamin C');
    await pressNative('qty-decrement');
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(h.onDecrement).not.toHaveBeenCalled();
  });

  it('stops at the maximum', async () => {
    const h = handlers();
    await renderWithProviders(<QuantityStepper testID="qty" value={99} {...h} />);
    await pressNative('qty-increment');
    expect(h.onIncrement).not.toHaveBeenCalled();
  });

  it('follows the screen reader increment and decrement actions', async () => {
    const h = handlers();
    await renderWithProviders(<QuantityStepper testID="qty" value={3} {...h} />);
    const root = screen.getByTestId('qty');
    root.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    root.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
    expect(h.onIncrement).toHaveBeenCalledTimes(1);
    expect(h.onDecrement).toHaveBeenCalledTimes(1);
  });
});
