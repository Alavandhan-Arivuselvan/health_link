import { View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export default function Records(){
  const [records,setRecords]=useState<string[]>([]);

  useEffect(()=>{
    AsyncStorage.getItem("records").then(data=>{
      if(data) setRecords(JSON.parse(data));
    });
  },[]);

  return(
    <View>
      {records.length===0 ? <Text>No records</Text> :
        records.map((r,i)=><Text key={i}>{r}</Text>)
      }
    </View>
  );
}
