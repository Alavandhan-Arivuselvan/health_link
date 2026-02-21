import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { LinearGradient } from "expo-linear-gradient";

const screenWidth = Dimensions.get("window").width;

export default function Graph() {
  return (
    <LinearGradient
      colors={["#0f2027", "#203a43", "#2c5364"]}
      style={styles.container}
    >
      <Text style={styles.title}>📈 Weekly Heart Rate</Text>

      <View style={styles.card}>
        <LineChart
          data={{
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            datasets: [
              {
                data: [72, 75, 78, 70, 74, 77, 73],
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          yAxisSuffix=" BPM"
          chartConfig={{
            backgroundGradientFrom: "#203a43",
            backgroundGradientTo: "#2c5364",
            decimalPlaces: 0,
            color: (opacity = 1) =>
              `rgba(0, 198, 255, ${opacity})`,
            labelColor: () => "#ffffff",
            propsForDots: {
              r: "6",
              strokeWidth: "2",
              stroke: "#00c6ff",
            },
          }}
          bezier
          style={{
            borderRadius: 16,
          }}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "white",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
});
