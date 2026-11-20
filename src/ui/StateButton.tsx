/**
 * The one button the empty and error states share. `primary` is the lime call to action (the only
 * lime on those screens, DESIGN §2 lime budget); `secondary` is an outline for "Try again", which
 * should not compete with the content it is trying to bring back.
 */
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';

export type StateButtonProps = {
  label: string;
  onPress: () => void;
  kind: 'primary' | 'secondary';
  icon?: LucideIcon;
  testID?: string;
};

export function StateButton({ label, onPress, kind, icon: Icon, testID }: StateButtonProps) {
  const styles = useStyles();
  const c = useColors();
  const primary = kind === 'primary';
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} testID={testID} style={primary ? styles.primary : styles.secondary}>
      <View style={styles.row}>
        {Icon ? <Icon size={18} color={primary ? c.onAccent : c.textPrimary} strokeWidth={size.iconStroke} /> : null}
        <Text variant="label" weight="semibold" tone={primary ? 'onAccent' : 'primary'}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  primary: {
    backgroundColor: c.accent,
    borderRadius: radius.button,
    paddingHorizontal: space.xl,
    justifyContent: 'center',
  },
  secondary: {
    borderColor: c.lineStrong,
    borderWidth: size.hairline,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
}));
