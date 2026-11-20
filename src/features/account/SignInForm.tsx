/**
 * Signed out: two steps on one screen. Email first, then the 6-digit code that was emailed.
 *
 * - Validation runs on Send, not on every keystroke, so nobody is told off while still typing.
 * - One error line under the field covers a bad address, a failed send and a wrong code, and is
 *   announced to TalkBack as it appears.
 * - Buttons are disabled while their request is in flight, so a double tap sends one email.
 * - "Send a new code" is locked for `RESEND_COOLDOWN_MS` after each send: Supabase rate-limits
 *   OTP emails, and a locked button explains less badly than a server error.
 * - Success needs no handling here: `verifyCode` moves the session to signedIn and the Account
 *   screen swaps this form out.
 */
import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { MAX_FONT_SCALE, typeStyle } from '@/design/typography';
import { useDirection } from '@/i18n/direction';
import type { MessageKey } from '@/i18n/strings';
import { useT } from '@/i18n/useT';
import { haptics } from '@/motion/haptics';
import { testIds } from '@/testIds';

import { CODE_LENGTH, isValidCode, isValidEmail, sendCode, verifyCode } from './auth';
import { FormButton } from './FormButton';

export const RESEND_COOLDOWN_MS = 30_000;

type Step = { kind: 'email' } | { kind: 'code'; email: string };

export function SignInForm() {
  const styles = useStyles();
  const c = useColors();
  const { lang, t } = useT();
  const { isRTL } = useDirection();
  const [step, setStep] = useState<Step>({ kind: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [resendLocked, setResendLocked] = useState(false);
  // A request can finish after this form is gone (a successful verify swaps it out): no state then.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!resendLocked) return;
    const timer = setTimeout(() => setResendLocked(false), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [resendLocked]);

  const send = async (address: string) => {
    if (!isValidEmail(address)) {
      setError('account.email.invalid');
      return;
    }
    haptics.tap();
    setPending(true);
    setError(null);
    const result = await sendCode(address);
    if (!mounted.current) return;
    setPending(false);
    if (!result.ok) {
      setError('account.error.send');
      return;
    }
    setResendLocked(true);
    setStep({ kind: 'code', email: address.trim() });
  };

  const verify = async (address: string) => {
    haptics.tap();
    setPending(true);
    setError(null);
    const result = await verifyCode(address, code);
    if (result.ok) {
      haptics.success(); // the form is usually unmounted by now: the signed-in view replaced it
      if (mounted.current) setPending(false);
      return;
    }
    if (!mounted.current) return;
    haptics.warn();
    setPending(false);
    setError('account.error.verify');
  };

  const changeEmail = () => {
    setStep({ kind: 'email' });
    setCode('');
    setError(null);
  };

  const inputText = [typeStyle(lang, 'body'), styles.input, { textAlign: isRTL ? 'right' : 'left' } as const];

  return (
    <View style={styles.root}>
      {step.kind === 'email' ? (
        <>
          <Text variant="heading" accessibilityRole="header">
            {t('account.signIn.title')}
          </Text>
          <Text variant="body" tone="muted">
            {t('account.signIn.body')}
          </Text>
          <Text variant="label" style={styles.label} nativeID="account-email-label">
            {t('account.email.label')}
          </Text>
          <TextInput
            testID={testIds.account.email}
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              if (error !== null) setError(null);
            }}
            onSubmitEditing={() => void send(email)}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            editable={!pending}
            placeholder={t('account.email.placeholder')}
            placeholderTextColor={c.textMuted}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={t('account.email.label')}
            accessibilityLabelledBy="account-email-label"
            style={[inputText, error !== null && styles.inputError]}
          />
          <ErrorLine message={error === null ? null : t(error)} />
          <FormButton
            kind="primary"
            label={t('account.sendCode')}
            onPress={() => void send(email)}
            pending={pending}
            testID={testIds.account.sendCode}
          />
        </>
      ) : (
        <>
          <Text variant="heading" accessibilityRole="header">
            {t('account.code.title')}
          </Text>
          <Text variant="body" tone="muted">
            {t('account.code.body', { email: step.email })}
          </Text>
          <Text variant="label" style={styles.label} nativeID="account-code-label">
            {t('account.code.label')}
          </Text>
          <TextInput
            testID={testIds.account.code}
            value={code}
            onChangeText={(next) => {
              setCode(next.replace(/\D/g, '').slice(0, CODE_LENGTH));
              if (error !== null) setError(null);
            }}
            onSubmitEditing={() => {
              if (isValidCode(code)) void verify(step.email);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            editable={!pending}
            autoFocus
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            accessibilityLabel={t('account.code.label')}
            accessibilityLabelledBy="account-code-label"
            style={[typeStyle(lang, 'title'), styles.input, styles.code, error !== null && styles.inputError]}
          />
          <ErrorLine message={error === null ? null : t(error)} />
          <FormButton
            kind="primary"
            label={t('account.verify')}
            onPress={() => void verify(step.email)}
            pending={pending}
            disabled={!isValidCode(code)}
            testID={testIds.account.verify}
          />
          <View style={styles.secondaryRow}>
            <View style={styles.half}>
              <FormButton
                kind="secondary"
                label={t('account.resend')}
                onPress={() => void send(step.email)}
                disabled={pending || resendLocked}
                testID={testIds.account.resend}
              />
            </View>
            <View style={styles.half}>
              <FormButton
                kind="secondary"
                label={t('account.changeEmail')}
                onPress={changeEmail}
                disabled={pending}
                testID={testIds.account.changeEmail}
              />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  const styles = useStyles();
  // The slot keeps its height when empty, so the button below does not jump when an error shows.
  return (
    <View style={styles.errorSlot} accessibilityLiveRegion="polite">
      {message !== null ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert" testID={testIds.account.error}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { rowGap: space.xs },
  label: { marginTop: space.md },
  input: {
    minHeight: size.touch,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.button,
    borderWidth: size.hairline,
    borderColor: c.lineStrong,
    backgroundColor: c.bgSurface,
    color: c.textPrimary,
  },
  inputError: { borderColor: c.danger },
  code: { textAlign: 'center', letterSpacing: space.xs },
  errorSlot: { minHeight: space.lg, justifyContent: 'center' },
  half: { flex: 1 },
  secondaryRow: { flexDirection: 'row', columnGap: space.xs, marginTop: space.xs },
}));
