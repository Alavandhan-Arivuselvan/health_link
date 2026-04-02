
import React, { useRef, useState } from 'react';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { BASE_URL } from '../../config/host';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

const VIEWER_URL = `${BASE_URL}/viewer`;

const WebScreen = () => {
  const [refreshKey] = useState(0);
  const webViewRef = useRef<any>(null);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          key={refreshKey}
          src={`${VIEWER_URL}?t=${refreshKey}`}
          style={{
            position: 'absolute' as const,
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%', border: 'none',
          }}
          title="HealthLink Body Canvas"
        />
      </View>
    );
  }

  try {
    const { WebView } = require('react-native-webview');
    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          key={refreshKey}
          source={{ uri: `${VIEWER_URL}?t=${refreshKey}` }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mixedContentMode="compatibility"
          scalesPageToFit={true}
          startInLoadingState={true}
          allowsFullscreenVideo={false}
        />
      </View>
    );
  } catch (e) {
    return (
      <View style={styles.fallback}>
        <View style={styles.iconCircle}>
          <Ionicons name="body" size={36} color={theme.colors.accent} />
        </View>
        <Text style={styles.fallbackTitle}>Health Canvas</Text>
        <Text style={styles.fallbackText}>
          Install react-native-webview to view the 3D anatomical model.
        </Text>
        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>VIEWER URL</Text>
          <Text style={styles.fallbackUrl} selectable>{VIEWER_URL}</Text>
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
    borderRadius: 24,
    backgroundColor: 'rgba(0,201,167,0.1)',
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
