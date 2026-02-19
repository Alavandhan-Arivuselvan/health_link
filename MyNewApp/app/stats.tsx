import { View, TextInput, Button, Alert,StyleSheet } from "react-native";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";

export default function Stats(){
  const [heart,setHeart]=useState("72");
  const [bp,setBp]=useState("");
  const [sugar,setSugar]=useState("95");

  return(
    <LinearGradient
              colors={["#0f2027", "#203a43", "#2c5364"]}
              style={styles.container}
            >
    <View style={{padding:20}}>
      <TextInput placeholder="Heart Rate" value={heart} onChangeText={setHeart}/>
      <TextInput placeholder="Blood Pressure" value={bp} onChangeText={setBp}/>
      <TextInput placeholder="Blood Sugar" value={sugar} onChangeText={setSugar}/>
      <Button title="Save" onPress={()=>Alert.alert("Saved")}/>
    </View>
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