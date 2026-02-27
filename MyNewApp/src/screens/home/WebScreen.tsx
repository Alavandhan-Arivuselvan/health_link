
import React from 'react';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { BASE_URL } from '../../config/host';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

const GRAPH_URL = `${BASE_URL}/graph`;

const WebScreen = () => {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src={GRAPH_URL}
          style={{
            position: 'absolute' as const,
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%', border: 'none',
          }}
          title="HealthLink Knowledge Graph"
        />
      </View>
    );
  }

  try {
    const { WebView } = require('react-native-webview');
    return (
      <WebView
        source={{ uri: GRAPH_URL }}
        style={styles.container}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    );
  } catch (e) {
    return (
      <View style={styles.fallback}>
        <View style={styles.iconCircle}>
          <Ionicons name="stats-chart" size={36} color={theme.colors.accent} />
        </View>
        <Text style={styles.fallbackTitle}>Knowledge Graph</Text>
        <Text style={styles.fallbackText}>
          Install react-native-webview to view the interactive graph on mobile.
        </Text>
        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>GRAPH URL</Text>
          <Text style={styles.fallbackUrl} selectable>{GRAPH_URL}</Text>
        </View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgDark,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.bgDark,
    padding: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.glassLight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.m,
  },
  fallbackTitle: {
    ...theme.typography.h2,
    marginBottom: 10,
  },
  fallbackText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  urlBox: {
    backgroundColor: theme.colors.bgCard,
    padding: 16,
    borderRadius: theme.borderRadius.m,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  urlLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 6,
  } as any,
  fallbackUrl: {
    color: theme.colors.accent,
    fontSize: 13,
  },
});

export default WebScreen;
