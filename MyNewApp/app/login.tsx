import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function Login() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");

  const sendOtp = () => {
    if (!phone) {
      Alert.alert("Error", "Please enter phone number");
      return;
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    Alert.alert("Demo OTP", `Your OTP is: ${code}`);
  };

  const handleLogin = async () => {
    if (otp === generatedOtp && generatedOtp !== "") {
      await AsyncStorage.setItem("logged_in", "true");
      router.replace("/");
    } else {
      Alert.alert("Invalid OTP");
    }
  };

  return (
    <LinearGradient
      colors={["#0f2027", "#203a43", "#2c5364"]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ width: "100%" }}
      >
        <Text style={styles.title}>🏥 Medical Health App</Text>

        <View style={styles.card}>
          <Text style={styles.label}>📱 Phone Number</Text>
          <TextInput
            placeholder="Enter phone number"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.input}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <TouchableOpacity style={styles.button} onPress={sendOtp}>
            <Text style={styles.buttonText}>Send OTP</Text>
          </TouchableOpacity>

          <Text style={styles.label}>🔑 Enter OTP</Text>
          <TextInput
            placeholder="Enter OTP"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.input}
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push("/register")}
          >
            <Text style={styles.linkText}>
              Don't have an account? Register
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "white",
    marginBottom: 30,
    textAlign: "center",
  },

  card: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  label: {
    color: "white",
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    color: "white",
  },

  button: {
    backgroundColor: "#00c6ff",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 10,
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },

  linkButton: {
    marginTop: 15,
    alignItems: "center",
  },

  linkText: {
    color: "#00c6ff",
  },
});
