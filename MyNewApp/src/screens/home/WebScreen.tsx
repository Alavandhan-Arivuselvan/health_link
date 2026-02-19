
import React from 'react';
import { StyleSheet } from 'react-native';
// import { WebView } from 'react-native-webview'; // Uncomment when dependency is installed
import { View, Text } from 'react-native'; // Fallback

const WebScreen = () => {
    const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 20px; background-color: #f0f0f0; }
          h1 { color: #2E7D32; }
          p { color: #333; }
          .card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        </style>
      </head>
      <body>
        <h1>Health Dashboard</h1>
        <div class="card">
          <p>This is a static HTML visualization embedded in the app.</p>
          <p>It can verify that WebView is working correctly.</p>
        </div>
      </body>
    </html>
  `;

    // return (
    //   <WebView
    //     originWhitelist={['*']}
    //     source={{ html: htmlContent }}
    //     style={styles.container}
    //   />
    // );

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text>WebView Placeholder (Uncomment code when react-native-webview is installed)</Text>
        </View>
    )
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default WebScreen;
