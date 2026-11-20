/**
 * `makeStyles` promises two things screens rely on: styles are built once (not per render), and
 * the sheet follows the scheme from `ThemeProvider`.
 */
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { darkPalette, lightPalette, type Palette } from '@/design/palette';
import { makeStyles, ThemeProvider, useColors, type Scheme } from '@/design/theme';

const factory = jest.fn((c: Palette) => ({ card: { backgroundColor: c.bgSurface } }));
const useStyles = makeStyles(factory);

function withScheme(scheme: Scheme) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ThemeProvider scheme={scheme}>{children}</ThemeProvider>;
  };
}

describe('theme', () => {
  it('builds both sheets once, when the module loads, not when components render', async () => {
    const { rerender, unmount } = await renderHook(() => useStyles(), { wrapper: withScheme('light') });
    await rerender({});
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenNthCalledWith(1, lightPalette);
    expect(factory).toHaveBeenNthCalledWith(2, darkPalette);
    await unmount();
  });

  it('returns the same style object on every render, so memoised children keep their props', async () => {
    const { result, rerender, unmount } = await renderHook(() => useStyles(), { wrapper: withScheme('light') });
    const first = result.current;
    await rerender({});
    expect(result.current).toBe(first);
    await unmount();
  });

  it('follows the scheme from the provider', async () => {
    const light = await renderHook(() => useStyles(), { wrapper: withScheme('light') });
    const dark = await renderHook(() => useStyles(), { wrapper: withScheme('dark') });
    expect(light.result.current.card.backgroundColor).toBe(lightPalette.bgSurface);
    expect(dark.result.current.card.backgroundColor).toBe(darkPalette.bgSurface);
    await light.unmount();
    await dark.unmount();
  });

  it('falls back to the light palette when no provider is mounted', async () => {
    const { result, unmount } = await renderHook(() => useColors());
    expect(result.current).toBe(lightPalette);
    await unmount();
  });
});
