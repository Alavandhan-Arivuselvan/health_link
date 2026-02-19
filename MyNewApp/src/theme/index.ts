
export const colors = {
  primary: '#2E7D32', // Dark Green
  secondary: '#66BB6A', // Light Green
  background: '#F1F8E9', // Very Light Green/White
  text: '#1B5E20', // Dark Green Text
  white: '#FFFFFF',
  error: '#D32F2F',
  gray: '#757575',
  lightGray: '#E0E0E0',
};

export const theme = {
  colors,
  spacing: {
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
  },
  borderRadius: {
    s: 4,
    m: 8,
    l: 16,
    xl: 24,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: 'bold', color: colors.text },
    h2: { fontSize: 24, fontWeight: 'bold', color: colors.text },
    body: { fontSize: 16, color: colors.text },
    button: { fontSize: 18, fontWeight: 'bold', color: colors.white },
    label: { fontSize: 14, fontWeight: '600', color: colors.text },
  },
};
