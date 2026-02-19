import * as DocumentPicker from "expo-document-picker";
import { View, Button, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Ingest() {
  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({});
    if(result.assets){
      const name = result.assets[0].name;
      const old = await AsyncStorage.getItem("records");
      const arr = old ? JSON.parse(old) : [];
      arr.push(name);
      await AsyncStorage.setItem("records", JSON.stringify(arr));
      Alert.alert("Saved");
    }
  };

  return (
    <View>
      <Button title="Upload PDF" onPress={pickFile} />
    </View>
  );
}
