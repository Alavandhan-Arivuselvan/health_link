import { View, TextInput, Button, Alert } from "react-native";
import { useState } from "react";

export default function Stats(){
  const [heart,setHeart]=useState("72");
  const [bp,setBp]=useState("");
  const [sugar,setSugar]=useState("95");

  return(
    <View style={{padding:20}}>
      <TextInput placeholder="Heart Rate" value={heart} onChangeText={setHeart}/>
      <TextInput placeholder="Blood Pressure" value={bp} onChangeText={setBp}/>
      <TextInput placeholder="Blood Sugar" value={sugar} onChangeText={setSugar}/>
      <Button title="Save" onPress={()=>Alert.alert("Saved")}/>
    </View>
  );
}
