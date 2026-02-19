import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Ingest() {
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({});

      if (!result.canceled && result.assets) {
        const name = result.assets[0].name;

        const old = await AsyncStorage.getItem("records");
        const arr = old ? JSON.parse(old) : [];

        arr.push(name);

        await AsyncStorage.setItem("records", JSON.stringify(arr));

        Alert.alert("Success", "File saved successfully ✅");
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong");
    }
  };

  return (
    <LinearGradient
      colors={["#0f2027", "#203a43", "#2c5364"]}
      style={styles.container}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>Upload Medical Records</Text>
          <Text style={styles.subtitle}>
            Securely store your PDFs and reports
          </Text>

          {/* Glass Card */}
          <View style={styles.card}>
            <Ionicons
              name="cloud-upload-outline"
              size={60}
              color="#00c6ff"
            />

            <Text style={styles.cardTitle}>Upload PDF</Text>
            <Text style={styles.cardDesc}>
              Select your medical document
            </Text>

            <TouchableOpacity style={styles.uploadBtn} onPress={pickFile}>
              <Ionicons name="add-circle-outline" size={20} color="white" />
              <Text style={styles.uploadText}> Select File</Text>
            </TouchableOpacity>
          </View>
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
    justifyContent: "center",
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
    marginBottom: 8,
  },

  subtitle: {
    color: "#ccc",
    marginBottom: 30,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 25,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  cardTitle: {
    fontSize: 18,
    color: "white",
    fontWeight: "600",
    marginTop: 15,
  },

  cardDesc: {
    color: "#aaa",
    marginBottom: 20,
  },

  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00c6ff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },

  uploadText: {
    color: "white",
    fontWeight: "600",
  },
});
