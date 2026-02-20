
import React from 'react';
import { StyleSheet, Platform, View, Text } from 'react-native';

const API_URL =
  Platform.OS === 'web'
    ? 'http://localhost:9000'
    : 'http://10.67.77.22:9000';

const GRAPH_URL = `${API_URL}/graph`;

const WebScreen = () => {
  if (Platform.OS === 'web') {
    // On web, use an iframe to render the interactive HTML graph
    return (
      <View style={styles.container}>
        <iframe
          src={GRAPH_URL}
          style={{
            position: 'absolute' as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title="HealthLink Knowledge Graph"
        />
      </View>
    );
  }

  // On native, try using react-native-webview
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
    // Fallback if react-native-webview is not installed
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>📊 Knowledge Graph</Text>
        <Text style={styles.fallbackText}>
          Install react-native-webview to view the interactive graph on mobile.
        </Text>
        <Text style={styles.fallbackUrl}>
          Or open in browser: {GRAPH_URL}
        </Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0f19',
    padding: 20,
  },
  fallbackTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: 'white',
    marginBottom: 12,
  },
  fallbackText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  fallbackUrl: {
    color: '#38bdf8',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default WebScreen;
