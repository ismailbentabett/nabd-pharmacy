/**
 * The title row above a Home rail: the section name at the reading start and "See all" at the end.
 * The chevron is mirrored in Arabic so it always points towards the reading end.
 */
import { ChevronRight } from 'lucide-react-native';
import { View } from 'react-native';

import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { layout, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { DirectionalIcon } from '@/ui/DirectionalIcon';

const CHEVRON = 16;

export type SectionHeaderProps = {
  title: string;
  onSeeAll: () => void;
  seeAllTestID?: string;
};

export function SectionHeader({ title, onSeeAll, seeAllTestID }: SectionHeaderProps) {
  const styles = useStyles();
  const c = useColors();
  const { t } = useT();
  const seeAll = t('home.seeAll');

  return (
    <View style={styles.row}>
      <Text variant="heading" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <PressableScale
        testID={seeAllTestID}
        onPress={onSeeAll}
        accessibilityRole="button"
        // "See all" alone does not say what; TalkBack reads "See all, Best sellers".
        accessibilityLabel={`${seeAll}, ${title}`}
        style={styles.seeAll}
      >
        <Text variant="label" weight="semibold" numberOfLines={1}>
          {seeAll}
        </Text>
        <DirectionalIcon icon={ChevronRight} size={CHEVRON} color={c.textPrimary} />
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: space.sm,
    paddingStart: layout.gutter,
    // The button's own padding lines its text up with the gutter.
    paddingEnd: layout.gutter - space.xs,
  },
  title: { flexShrink: 1 },
  seeAll: { flexDirection: 'row', alignItems: 'center', columnGap: space.xxs, paddingHorizontal: space.xs },
}));
