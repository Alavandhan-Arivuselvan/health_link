
export const colors = {
  // Dark health-tech palette
  bgDark: '#0B1120',
  bgCard: '#1A2332',
  bgCardLight: '#1E2A3A',
  accent: '#00D4AA',
  accentLight: '#00E5C0',
  accentDark: '#00B894',
  text: '#FFFFFF',
  textMuted: '#8899AA',
  textSecondary: '#A0B0C0',
  white: '#FFFFFF',
  error: '#FF6B6B',
  errorLight: '#FF8A8A',
  gray: '#6B7B8D',
  lightGray: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.15)',
  glassBg: 'rgba(26, 35, 50, 0.85)',
  glassLight: 'rgba(255,255,255,0.06)',
  // Legacy aliases for backward compat
  primary: '#00D4AA',
  secondary: '#00E5C0',
  background: '#0B1120',
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
    s: 6,
    m: 12,
    l: 18,
    xl: 26,
    full: 999,
  },
  typography: {
    h1: { fontSize: 30, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
    h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.3 },
    h3: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
    body: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
    button: { fontSize: 16, fontWeight: '700' as const, color: colors.white, letterSpacing: 0.3 },
    label: { fontSize: 13, fontWeight: '600' as const, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' as const },
    caption: { fontSize: 12, color: colors.textMuted },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: '#00D4AA',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
  },
};
