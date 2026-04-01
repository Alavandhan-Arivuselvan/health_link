
export const colors = {
  // Aetheris Clinical — flat dark palette
  bgDark: '#0D1117',
  bgCard: '#161B22',
  bgCardLight: '#1C2128',
  accent: '#00C9A7',
  accentLight: '#33D4B8',
  accentDark: '#00A88C',
  text: '#E6EDF3',
  textMuted: '#8B949E',
  textSecondary: '#C9D1D9',
  white: '#FFFFFF',
  error: '#F85149',
  errorLight: '#FF7B72',
  gray: '#484F58',
  lightGray: 'rgba(110,118,129,0.1)',
  border: 'rgba(48,54,61,0.8)',
  borderLight: 'rgba(48,54,61,0.4)',
  glassBg: '#161B22',
  glassLight: 'rgba(0,201,167,0.06)',
  // Legacy aliases
  primary: '#00C9A7',
  secondary: '#33D4B8',
  background: '#0D1117',
};

export const theme = {
  colors,
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    s: 8,
    m: 16,
    l: 20,
    xl: 24,
    full: 999,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.3 },
    h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
    h3: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
    body: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
    button: { fontSize: 16, fontWeight: '700' as const, color: colors.white, letterSpacing: 0.2 },
    label: { fontSize: 12, fontWeight: '600' as const, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' as const },
    caption: { fontSize: 12, color: colors.textMuted },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    glow: {
      shadowColor: '#00C9A7',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
  },
};
