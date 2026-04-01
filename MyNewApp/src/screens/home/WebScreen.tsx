
import React, { useRef, useState } from 'react';
import { StyleSheet, Platform, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BASE_URL } from '../../config/host';
import { theme } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

const GRAPH_URL = `${BASE_URL}/api/graph-html`;

const WebScreen = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const webViewRef = useRef<any>(null);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey(prev => prev + 1);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const RefreshButton = () => (
    <TouchableOpacity
      style={styles.refreshBtn}
      onPress={handleRefresh}
      activeOpacity={0.7}
    >
      {refreshing ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="refresh" size={20} color="#fff" />
      )}
      <Text style={styles.refreshText}>
        {refreshing ? 'Loading...' : 'Refresh Graph'}
      </Text>
    </TouchableOpacity>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          key={refreshKey}
          src={`${GRAPH_URL}?t=${refreshKey}`}
          style={{
            position: 'absolute' as const,
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%', border: 'none',
          }}
          title="HealthLink Knowledge Graph"
        />
        <RefreshButton />
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
          source={{ uri: `${GRAPH_URL}?t=${refreshKey}` }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
        <RefreshButton />
      </View>
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
  refreshBtn: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  refreshText: {
    color: theme.colors.bgDark,
    fontSize: 14,
    fontWeight: '600',
  } as any,
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
