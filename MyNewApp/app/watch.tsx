import { View, Button, Alert } from "react-native";

export default function Watch(){
  return(
    <View>
      <Button title="Connect Watch" onPress={()=>Alert.alert("Watch Connected (Demo Mode)")}/>
    </View>
  );
}
