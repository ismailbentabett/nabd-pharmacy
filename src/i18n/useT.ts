/**
 * `const { t, tn } = useT()` inside components. The translator for each language is built once,
 * so its identity is stable and passing `t` down never invalidates a memo or a compiled component.
 */
import { useLocale } from './direction';
import type { Lang } from './format';
import { t, tn, type MessageKey, type PluralKey, type Vars } from './strings';

export type Translator = Readonly<{
  lang: Lang;
  t: (key: MessageKey, vars?: Vars) => string;
  tn: (key: PluralKey, n: number, vars?: Vars) => string;
}>;

function translatorFor(lang: Lang): Translator {
  return Object.freeze({
    lang,
    t: (key: MessageKey, vars?: Vars) => t(lang, key, vars),
    tn: (key: PluralKey, n: number, vars?: Vars) => tn(lang, key, n, vars),
  });
}

const TRANSLATORS: Readonly<Record<Lang, Translator>> = { en: translatorFor('en'), ar: translatorFor('ar') };

export function useT(): Translator {
  return TRANSLATORS[useLocale().lang];
}
