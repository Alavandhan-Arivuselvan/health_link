import React, { useState } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");

  const sendOtp = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(code);
    Alert.alert("Demo OTP", code);
  };

  const handleRegister = async () => {
    if (otp === generatedOtp) {
      await AsyncStorage.setItem("user_data", JSON.stringify({ name, age, phone }));
      Alert.alert("Registered Successfully");
      router.replace("/login");
    } else {
      Alert.alert("Invalid OTP");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>
      <TextInput placeholder="Full Name" style={styles.input} onChangeText={setName} />
      <TextInput placeholder="Age" style={styles.input} onChangeText={setAge} />
      <TextInput placeholder="Phone" style={styles.input} onChangeText={setPhone} />
      <Button title="Send OTP" onPress={sendOtp} />
      <TextInput placeholder="Enter OTP" style={styles.input} onChangeText={setOtp} />
      <Button title="Register" onPress={handleRegister} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, justifyContent:"center", padding:20 },
  title:{ fontSize:24, marginBottom:20 },
  input:{ borderWidth:1, padding:10, marginVertical:10 }
});
