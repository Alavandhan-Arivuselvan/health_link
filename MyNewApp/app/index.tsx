import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function Dashboard() {
  return (
    <LinearGradient
      colors={["#0f2027", "#203a43", "#2c5364"]}
      style={styles.container}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome Back 👋</Text>
          <Text style={styles.subtitle}>
            Monitor your health from the side dashboard.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    color: "white",
    fontWeight: "700",
    marginBottom: 10,
  },
  subtitle: {
    color: "#ccc",
    fontSize: 16,
  },
});
