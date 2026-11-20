/**
 * A request failed (the fake API fails about 1 in 20 times on purpose, D-05). Two shapes:
 *
 * - full: a centred block for a screen that has nothing to show yet (first page failed).
 * - compact: one row for a list footer, so a failed *next* page never hides what is already loaded
 *   (ARCHITECTURE §7). The row is at least 48 dp tall and the whole row is the retry target.
 *
 * Both announce themselves politely to TalkBack, so a blind user hears that loading stopped.
 */
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { View } from 'react-native';

import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';

import { StateButton } from './StateButton';

const DISC = 72;

export type ErrorStateProps = {
  onRetry: () => void;
  title?: string;
  body?: string;
  /** One row for a list footer instead of a centred block. */
  compact?: boolean;
  testID?: string;
};

export function ErrorState({ onRetry, title, body, compact = false, testID }: ErrorStateProps) {
  const styles = useStyles();
  const c = useColors();
  const { t } = useT();
  const heading = title ?? t('state.error.title');
  const retry = t('state.retry');

  if (compact) {
    return (
      <PressableScale
        onPress={onRetry}
        accessibilityLabel={`${heading}. ${retry}`}
        testID={testID}
        shrinkOnPress={false}
        style={styles.row}
      >
        <View style={styles.rowInner} accessibilityLiveRegion="polite">
          <Text variant="label" tone="muted" numberOfLines={1} style={styles.rowText}>
            {heading}
          </Text>
          <View style={styles.rowAction}>
            <RefreshCw size={16} color={c.textPrimary} strokeWidth={size.iconStroke} />
            <Text variant="label" weight="semibold">
              {retry}
            </Text>
          </View>
        </View>
      </PressableScale>
    );
  }

  return (
    <View testID={testID} style={styles.root} accessibilityLiveRegion="polite">
      <View style={styles.disc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <CloudOff size={32} color={c.textMuted} strokeWidth={size.iconStroke} />
      </View>
      <Text variant="heading" align="center" accessibilityRole="header">
        {heading}
      </Text>
      <Text variant="body" tone="muted" align="center" style={styles.body}>
        {body ?? t('state.error.body')}
      </Text>
      <View style={styles.action}>
        <StateButton kind="secondary" icon={RefreshCw} label={retry} onPress={onRetry} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl, paddingVertical: space.xxl },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: radius.pill,
    backgroundColor: c.bgSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  body: { marginTop: space.xs },
  action: { marginTop: space.xl },
  row: { justifyContent: 'center', paddingHorizontal: space.md, marginVertical: space.xs },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minHeight: size.touch,
    paddingHorizontal: space.md,
    borderRadius: radius.button,
    backgroundColor: c.bgSurface,
    borderColor: c.lineHairline,
    borderWidth: size.hairline,
  },
  rowText: { flexShrink: 1 },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
}));
