/**
 * Helpers shared by the Category tests (grid, screen, sheet flow): a screen-sized safe area, a
 * fresh query client per render, catalogue lookups, and a "let everything land" wait.
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getCatalog, type Product } from '@/core/catalog';

import { testQueryClient } from './queryClient';
import { renderWithProviders, type RenderOptions } from './render';

export const METRICS = { frame: { x: 0, y: 0, width: 400, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

export const noop = () => {};

/** The first catalogue product that matches, in catalogue (relevance) order. */
export function firstProduct(match: (p: Product) => boolean): Product {
  const product = getCatalog().products.find(match);
  if (!product) throw new Error('No product matches');
  return product;
}

/** The catalog product at `index` in the default (relevance) order, which is also the grid's order. */
export function productAt(index: number): Product {
  const product = getCatalog().products[index];
  if (!product) throw new Error(`No product at ${index}`);
  return product;
}

/** Renders inside the app's providers plus a safe area and a fresh query client. */
export async function renderScreen(ui: ReactElement, options?: RenderOptions) {
  const client = testQueryClient();
  return renderWithProviders(
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </SafeAreaProvider>,
    options,
  );
}

/** A query client wrapper for `renderHook`. */
export function queryWrapper() {
  const client = testQueryClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** Let pending requests, React Query notifications and FlashList layout passes finish. */
export async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}
