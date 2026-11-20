/**
 * The Account tab. One view per session status (src/state/session.store.ts):
 *
 *   offline    no Supabase keys in this build: say so plainly; favourites and the in-memory order
 *              history still work on the fake backend, so the screen keeps them
 *   loading    the stored session is being read: a skeleton the shape of the signed-out form
 *   signedOut  email → code sign-in (SignInForm)
 *   signedIn   who is signed in, sign out, favourites, orders
 *
 * The screen only reads the session; `auth.ts` is the one place that changes it. The footer says which
 * backend served the data (`api.kind`), so a demo is honest about where the numbers came from.
 * No layout animations here: the views swap instantly, which is also the reduced-motion behaviour.
 */
import { CloudOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design/Text';
import { makeStyles } from '@/design/theme';
import { layout, radius, size, space } from '@/design/tokens';
import { OrdersSection } from '@/features/orders/OrdersSection';
import { useT } from '@/i18n/useT';
import { haptics } from '@/motion/haptics';
import { api } from '@/state/api';
import { useSession } from '@/state/session.store';
import { testIds } from '@/testIds';
import { EmptyState } from '@/ui/EmptyState';
import { onFirstScreenLayout } from '@/ui/LaunchVeil';
import { Skeleton } from '@/ui/Skeleton';

import { signOut } from './auth';
import { FavoritesList } from './FavoritesList';
import { FormButton } from './FormButton';
import { SignInForm } from './SignInForm';

export function AccountScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const status = useSession((s) => s.status);

  let body: React.ReactNode;
  if (status === 'offline') {
    body = (
      <>
        <EmptyState
          icon={CloudOff}
          title={t('account.offline.title')}
          body={t('account.offline.body')}
          testID={testIds.account.offline}
        />
        <View style={styles.section}>
          <LocalData />
        </View>
        <BackendLabel label={t('account.backend.fake')} />
      </>
    );
  } else if (status === 'loading') {
    body = <AccountSkeleton />;
  } else if (status === 'signedOut') {
    body = (
      <>
        <SignInForm />
        <BackendLabel label={t(api.kind === 'supabase' ? 'account.backend.supabase' : 'account.backend.fake')} />
      </>
    );
  } else {
    body = <SignedInView />;
  }

  return (
    <View testID={testIds.screen.account} style={[styles.root, { paddingTop: insets.top }]} onLayout={onFirstScreenLayout}>
      <View style={styles.header}>
        <Text variant="title" weight="semibold" numberOfLines={1} accessibilityRole="header">
          {t('account.title')}
        </Text>
      </View>
      {/* Android resizes the window for the keyboard on its own; iOS needs the padding. */}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SignedInView() {
  const styles = useStyles();
  const { t } = useT();
  const email = useSession((s) => s.email) ?? '';
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onSignOut = async () => {
    haptics.tap();
    setPending(true);
    await signOut();
    // A successful sign-out unmounts this view; only reset the spinner if it is still here.
    if (mounted.current) setPending(false);
  };

  return (
    <View style={styles.section} testID={testIds.account.signedIn}>
      <View style={styles.card}>
        <Text variant="body" numberOfLines={2}>
          {t('account.signedInAs', { email })}
        </Text>
        <FormButton
          kind="secondary"
          label={t('account.signOut')}
          onPress={() => void onSignOut()}
          pending={pending}
          testID={testIds.account.signOut}
        />
      </View>
      <LocalData />
      <BackendLabel label={t(api.kind === 'supabase' ? 'account.backend.supabase' : 'account.backend.fake')} />
    </View>
  );
}

/** Favourites and order history: shown signed in, and in the offline build (where they are local). */
function LocalData() {
  const styles = useStyles();
  const { t } = useT();
  return (
    <>
      <Text variant="heading" accessibilityRole="header" style={styles.sectionTitle}>
        {t('account.favorites.title')}
      </Text>
      <FavoritesList />
      <OrdersSection />
    </>
  );
}

function BackendLabel({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <Text variant="caption" tone="muted" align="center" style={styles.backend} testID={testIds.account.backend}>
      {label}
    </Text>
  );
}

const SKELETON_BAR = 12;

function AccountSkeleton() {
  const styles = useStyles();
  return (
    <View
      testID={testIds.account.loading}
      style={styles.section}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Skeleton width="60%" height={SKELETON_BAR * 2} radius={radius.pill} />
      <Skeleton width="90%" height={SKELETON_BAR} radius={radius.pill} />
      <Skeleton width="100%" height={size.touch} radius={radius.button} style={styles.skeletonGap} />
      <Skeleton width="100%" height={size.touch} radius={radius.button} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bgApp },
  fill: { flex: 1 },
  header: { minHeight: size.touch, justifyContent: 'center', paddingHorizontal: layout.gutter },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.md, flexGrow: 1 },
  section: { rowGap: space.sm },
  sectionTitle: { marginTop: space.md },
  card: {
    rowGap: space.sm,
    padding: space.md,
    borderRadius: radius.tile,
    backgroundColor: c.bgSurface,
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
  },
  backend: { marginTop: space.xl },
  skeletonGap: { marginTop: space.lg },
}));
