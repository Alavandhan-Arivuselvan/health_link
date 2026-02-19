import { View, Button, Alert, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function Watch(){
  return(
    <LinearGradient
                  colors={["#0f2027", "#203a43", "#2c5364"]}
                  style={styles.container}
                >
    <View>
      <Button title="Connect Watch" onPress={()=>Alert.alert("Watch Connected (Demo Mode)")}/>
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