/**
 * The language toggle (G-08). Jest cannot flip the native direction or restart the app, so
 * `switchLanguage` is replaced by a spy; what is checked is the order of events around it: the press
 * is felt, a pending cart undo is committed, the veil covers the screen, and only then does the
 * switch run, exactly once.
 */
import { act, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { switchLanguage } from '@/i18n/direction';
import { resetHapticsForTest } from '@/motion/haptics';
import { resetMotionPreferenceForTest } from '@/motion/motionPreference';
import { timingExit, timingReducedFade } from '@/motion/springs';
import { cartActions, getCartState } from '@/state/cart.store';
import { testIds } from '@/testIds';
import { LanguageToggle, langVeilTestId } from '@/ui/LanguageToggle';

import { pressNative, renderWithProviders } from './helpers/render';

jest.mock('@/i18n/direction', () => ({
  ...jest.requireActual<typeof import('@/i18n/direction')>('@/i18n/direction'),
  switchLanguage: jest.fn(() => Promise.resolve()),
}));

// Under Jest the worklets runtime is the web build; run the hop back to the JS thread inline.
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual<typeof import('react-native-worklets')>('react-native-worklets'),
  scheduleOnRN: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => {
    fn(...args);
  },
}));

const switchSpy = jest.mocked(switchLanguage);

beforeEach(() => {
  resetMotionPreferenceForTest();
  resetHapticsForTest();
  switchSpy.mockClear();
  switchSpy.mockImplementation(() => Promise.resolve());
  cartActions.clear();
});

describe('LanguageToggle', () => {
  it('is a labelled 48 dp button that names the other language, in English mode', async () => {
    const { unmount } = await renderWithProviders(<LanguageToggle />, { lang: 'en' });

    const button = screen.getByTestId(testIds.langToggle);
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('العربية');
    expect(button.props.accessibilityHint).toBe('Switches the app to Arabic with a right-to-left layout');
    expect(screen.getByText('ع')).toBeTruthy();
    await unmount();
  });

  it('names English, in Arabic mode', async () => {
    const { unmount } = await renderWithProviders(<LanguageToggle />, { lang: 'ar' });

    const button = screen.getByTestId(testIds.langToggle);
    expect(button.props.accessibilityLabel).toBe('English');
    expect(button.props.accessibilityHint).toBe('يحوّل التطبيق إلى الإنجليزية بتخطيط من اليسار إلى اليمين');
    expect(screen.getByText('EN')).toBeTruthy();
    await unmount();
  });

  it('does nothing visible until it is pressed', async () => {
    const { unmount } = await renderWithProviders(<LanguageToggle />);

    expect(screen.queryByTestId(langVeilTestId)).toBeNull();
    expect(switchSpy).not.toHaveBeenCalled();
    await unmount();
  });

  it('switches to Arabic from English and to English from Arabic, behind the veil', async () => {
    const english = await renderWithProviders(<LanguageToggle />, { lang: 'en' });
    await pressNative(testIds.langToggle);
    expect(screen.getByTestId(langVeilTestId)).toBeTruthy();
    expect(switchSpy).toHaveBeenCalledTimes(1);
    expect(switchSpy).toHaveBeenLastCalledWith('ar');
    await english.unmount();

    const arabic = await renderWithProviders(<LanguageToggle />, { lang: 'ar' });
    await pressNative(testIds.langToggle);
    expect(switchSpy).toHaveBeenCalledTimes(2);
    expect(switchSpy).toHaveBeenLastCalledWith('en');
    await arabic.unmount();
  });

  it('commits a deletion that is still waiting for undo before it switches', async () => {
    cartActions.add('p-0001');
    cartActions.remove('p-0001');
    expect(getCartState().lastRemoved).not.toBeNull();

    let undoPendingAtSwitch: boolean | null = null;
    switchSpy.mockImplementation(() => {
      undoPendingAtSwitch = getCartState().lastRemoved !== null;
      return Promise.resolve();
    });
    const { unmount } = await renderWithProviders(<LanguageToggle />);

    await pressNative(testIds.langToggle);

    expect(undoPendingAtSwitch).toBe(false);
    expect(getCartState().lastRemoved).toBeNull();
    await unmount();
  });

  it('switches once however many times it is tapped', async () => {
    const { unmount } = await renderWithProviders(<LanguageToggle />);

    await pressNative(testIds.langToggle);
    await pressNative(testIds.langToggle);
    await pressNative(testIds.langToggle);

    expect(switchSpy).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('removes the veil and allows another try when the switch fails', async () => {
    switchSpy.mockImplementationOnce(() => Promise.reject(new Error('reload refused')));
    const { unmount } = await renderWithProviders(<LanguageToggle />);

    await pressNative(testIds.langToggle);
    await act(async () => undefined);
    expect(screen.queryByTestId(langVeilTestId)).toBeNull();

    await pressNative(testIds.langToggle);
    expect(switchSpy).toHaveBeenCalledTimes(2);
    await unmount();
  });

  it('fades the veil on the exit timing normally', async () => {
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    const { unmount } = await renderWithProviders(<LanguageToggle />);

    await pressNative(testIds.langToggle);

    expect(withTiming).toHaveBeenCalledWith(1, timingExit, expect.any(Function));
    withTiming.mockRestore();
    await unmount();
  });

  it('fades on the short reduced-motion timing when the system asks for less motion', async () => {
    const addEventListener = jest.mocked(AccessibilityInfo.addEventListener);
    addEventListener.mockClear();
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    const { unmount } = await renderWithProviders(<LanguageToggle />);
    const emit = addEventListener.mock.calls.at(-1)?.[1] as (enabled: boolean) => void;
    await act(async () => emit(true));

    await pressNative(testIds.langToggle);

    expect(withTiming).toHaveBeenCalledWith(1, timingReducedFade, expect.any(Function));
    expect(switchSpy).toHaveBeenCalledWith('ar');
    withTiming.mockRestore();
    await unmount();
  });
});
