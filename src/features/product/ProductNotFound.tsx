/**
 * The product route with an id the catalog does not know (a stale deep link, a typo). The page is
 * a transparent modal, so it paints its own background; Back and the button both leave it. With
 * no history to go back to (opened cold from a link), the button goes Home instead.
 */
import { router } from 'expo-router';
import { PackageX } from 'lucide-react-native';
import { View } from 'react-native';

import { makeStyles } from '@/design/theme';
import { useT } from '@/i18n/useT';
import { testIds } from '@/testIds';
import { EmptyState } from '@/ui/EmptyState';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function ProductNotFound() {
  const styles = useStyles();
  const { t } = useT();
  return (
    <View style={styles.root}>
      <EmptyState
        icon={PackageX}
        title={t('product.notFound.title')}
        body={t('product.notFound.body')}
        action={{ label: t('product.notFound.action'), onPress: leave, testID: testIds.productNotFoundAction }}
        testID={testIds.productNotFound}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, justifyContent: 'center', backgroundColor: c.bgApp },
}));
