/**
 * The horizontal category rail (H-03): eight round icon tiles with their names. A tap opens the
 * Category tab with that category already filtered; "See all" opens it unfiltered.
 *
 * Eight fixed items do not need virtualisation, so this is a plain horizontal ScrollView. In Arabic
 * the row mirrors natively: the first category sits at the right and the rail scrolls leftwards.
 * Labels wrap to two lines and the tiles grow with the system font, so nothing is clipped at 1.5x.
 */
import {
  Baby,
  Bath,
  Cross,
  Dumbbell,
  FlaskConical,
  Pill,
  Scissors,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { CATEGORIES, type Category } from '@/core/catalog';
import { PressableScale } from '@/design/PressableScale';
import { Text } from '@/design/Text';
import { makeStyles, useColors } from '@/design/theme';
import { layout, radius, size, space } from '@/design/tokens';
import { useT } from '@/i18n/useT';
import { testIds } from '@/testIds';

import { openCategory } from './homeRoutes';
import { SectionHeader } from './SectionHeader';

const DISC = 64;
const TILE_WIDTH = 76;

/** The seed names each category's lucide icon; unknown names fall back to the pharmacy cross. */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  pill: Pill,
  sparkles: Sparkles,
  baby: Baby,
  bath: Bath,
  cross: Cross,
  scissors: Scissors,
  dumbbell: Dumbbell,
  'flask-conical': FlaskConical,
};

type TileProps = { category: Category };

function CategoryTile({ category }: TileProps) {
  const styles = useStyles();
  const c = useColors();
  const { lang } = useT();
  const Icon = ICONS[category.icon] ?? Cross;
  const name = category[lang];

  return (
    <PressableScale
      testID={testIds.homeCategory(category.id)}
      onPress={() => openCategory(category.id)}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={styles.tile}
    >
      <View style={styles.disc}>
        <Icon size={size.icon} color={c.textPrimary} strokeWidth={size.iconStroke} />
      </View>
      <Text variant="caption" align="center" numberOfLines={2}>
        {name}
      </Text>
    </PressableScale>
  );
}

export function CategoryRail() {
  const styles = useStyles();
  const { t } = useT();

  return (
    <View style={styles.section}>
      <SectionHeader title={t('home.categories')} onSeeAll={() => openCategory(null)} seeAllTestID={testIds.homeSeeAll} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {CATEGORIES.map((category) => (
          <CategoryTile key={category.id} category={category} />
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  section: { rowGap: space.xs },
  rail: { paddingHorizontal: layout.gutter, columnGap: space.xs },
  tile: { width: TILE_WIDTH, alignItems: 'center', rowGap: space.xs, paddingVertical: space.xxs },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: size.hairline,
    borderColor: c.lineHairline,
    backgroundColor: c.bgSurface,
  },
}));
