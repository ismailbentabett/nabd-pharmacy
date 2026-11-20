import { DEFAULT_WEIGHT, FONT_FAMILY, typeStyle, type Variant } from '@/design/typography';

const LATIN: Record<Variant, [number, number]> = {
  display: [28, 34],
  title: [22, 28],
  heading: [18, 24],
  body: [15, 22],
  label: [13, 18],
  caption: [12, 16],
};

// Latin + 1 px, line height x1.15 rounded up (DESIGN §2). Written out so a formula change shows up.
const ARABIC: Record<Variant, [number, number]> = {
  display: [29, 40],
  title: [23, 33],
  heading: [19, 28],
  body: [16, 26],
  label: [14, 21],
  caption: [13, 19],
};

const VARIANTS = Object.keys(LATIN) as Variant[];

describe('type scale', () => {
  it.each(VARIANTS)('Latin %s has the documented size and line height', (variant) => {
    const style = typeStyle('en', variant);
    expect([style.fontSize, style.lineHeight]).toEqual(LATIN[variant]);
  });

  it.each(VARIANTS)('Arabic %s is one size up with more line height', (variant) => {
    const style = typeStyle('ar', variant);
    expect([style.fontSize, style.lineHeight]).toEqual(ARABIC[variant]);
  });

  it('never sets fontWeight, so Android does not fake a bold on a single-weight file', () => {
    for (const lang of ['en', 'ar'] as const) {
      for (const variant of VARIANTS) {
        for (const weight of ['regular', 'medium', 'semibold'] as const) {
          expect(typeStyle(lang, variant, weight)).not.toHaveProperty('fontWeight');
        }
      }
    }
  });

  it('picks the font file for the language and weight', () => {
    expect(typeStyle('en', 'body').fontFamily).toBe(FONT_FAMILY.en.regular);
    expect(typeStyle('ar', 'title').fontFamily).toBe(FONT_FAMILY.ar.semibold);
    expect(typeStyle('ar', 'label', 'regular').fontFamily).toBe('IBMPlexSansArabic_400Regular');
  });

  it('uses the default weight for each variant', () => {
    for (const variant of VARIANTS) {
      expect(typeStyle('en', variant).fontFamily).toBe(FONT_FAMILY.en[DEFAULT_WEIGHT[variant]]);
    }
  });

  it('returns the same frozen object every call, so it is safe in hook deps', () => {
    const first = typeStyle('ar', 'heading');
    expect(typeStyle('ar', 'heading')).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
