import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function AI() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([
    { id: "1", text: "Hello 👋 I'm your Health AI Assistant.", sender: "bot" },
  ]);

  const sendMessage = () => {
    if (!message.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      text: message,
      sender: "user",
    };

    const botReply = {
      id: (Date.now() + 1).toString(),
      text: "Analyzing your health data... 🧠",
      sender: "bot",
    };

    setChat([...chat, userMsg, botReply]);
    setMessage("");
  };

  const renderItem = ({ item }: any) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === "user"
          ? styles.userBubble
          : styles.botBubble,
      ]}
    >
      <Text style={styles.messageText}>{item.text}</Text>
    </View>
  );

  return (
    <LinearGradient
      colors={["#0f2027", "#203a43", "#2c5364"]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={styles.title}>🤖 Health AI</Text>

        <FlatList
          data={chat}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 20 }}
        />

        <View style={styles.inputContainer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Ask about your health..."
            placeholderTextColor="#ccc"
            style={styles.input}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Text style={{ color: "white", fontWeight: "bold" }}>
              Send
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
    paddingTop: 50,
    paddingHorizontal: 15,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
    marginBottom: 10,
  },

  messageBubble: {
    padding: 12,
    marginVertical: 6,
    borderRadius: 16,
    maxWidth: "80%",
  },

  userBubble: {
    backgroundColor: "#00c6ff",
    alignSelf: "flex-end",
  },

  botBubble: {
    backgroundColor: "rgba(255,255,255,0.1)",
    alignSelf: "flex-start",
  },

  messageText: {
    color: "white",
  },

  inputContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },

  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 12,
    borderRadius: 12,
    color: "white",
    marginRight: 10,
  },

  sendBtn: {
    backgroundColor: "#00c6ff",
    paddingHorizontal: 18,
    justifyContent: "center",
    borderRadius: 12,
  },
});
