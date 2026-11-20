/**
 * "Nothing here" for a list or a screen: an icon in a soft disc, a title, an optional line of help
 * and an optional way out (e.g. "Browse categories" from an empty cart). The copy comes from the
 * caller, so each place says what is actually empty instead of a generic "No data".
 */
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';

import { StateButton } from './StateButton';

/** The disc behind the icon. Big enough to anchor the block, small enough to stay calm. */
const DISC = 72;

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; testID?: string };
  testID?: string;
};

export function EmptyState({ icon: Icon, title, body, action, testID }: EmptyStateProps) {
  const styles = useStyles();
  const c = useColors();
  return (
    <View testID={testID} style={styles.root}>
      <View style={styles.disc} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon size={32} color={c.textMuted} strokeWidth={size.iconStroke} />
      </View>
      <Text variant="heading" align="center" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="muted" align="center" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {action ? (
        <View style={styles.action}>
          <StateButton kind="primary" label={action.label} onPress={action.onPress} testID={action.testID} />
        </View>
      ) : null}
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
}));
