/**
 * The Account forms' button: StateButton's look, plus the in-flight spinner and disabled state a
 * form needs. Primary is the gold call to action; secondary is an outline for the quieter choices.
 */
import { ActivityIndicator, View } from 'react-native';

import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { radius, size, space } from '@/design/tokens';

type FormButtonProps = {
  kind: 'primary' | 'secondary';
  label: string;
  onPress: () => void;
  pending?: boolean;
  disabled?: boolean;
  testID: string;
};

export function FormButton({ kind, label, onPress, pending = false, disabled = false, testID }: FormButtonProps) {
  const styles = useStyles();
  const c = useColors();
  const primary = kind === 'primary';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || pending}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={primary ? styles.primary : styles.secondary}
    >
      <View style={styles.row}>
        {pending ? <ActivityIndicator size="small" color={primary ? c.onAccent : c.textPrimary} /> : null}
        <Text variant="label" weight="semibold" tone={primary ? 'onAccent' : 'primary'} align="center">
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((c) => ({
  primary: {
    minHeight: size.touch,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    borderRadius: radius.button,
    backgroundColor: c.accent,
  },
  secondary: {
    minHeight: size.touch,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.button,
    borderWidth: size.hairline,
    borderColor: c.lineStrong,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: space.xs },
}));
