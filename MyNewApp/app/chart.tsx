// import React, { useState, useEffect } from 'react';
// import { 
//   StyleSheet, Text, View, ScrollView, TouchableOpacity, 
//   Dimensions, ActivityIndicator, SafeAreaView 
// } from 'react-native';
// import axios from 'axios';
// import { LineChart } from 'react-native-chart-kit';

// const screenWidth = Dimensions.get("window").width;

// // --- Sub-Component: High-End Risk Bar ---
// const RiskBar = ({ label, percentage }) => {
//   const getBarColor = (perc) => {
//     if (perc < 30) return '#4CAF50'; // Green
//     if (perc < 70) return '#FFB300'; // Yellow
//     return '#FF5252';                // Red
//   };

//   return (
//     <View style={styles.riskBarContainer}>
//       <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
//         <Text style={styles.riskBarLabel}>{label}</Text>
//         <Text style={[styles.riskBarValue, { color: getBarColor(percentage) }]}>
//           {percentage}%
//         </Text>
//       </View>
//       <View style={styles.barTrack}>
//         <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: getBarColor(percentage) }]} />
//       </View>
//     </View>
//   );
// };

// // --- Main Dashboard Component ---
// export default function HealthDashboard() {
//   const [selectedWeek, setSelectedWeek] = useState('current'); // 'past' or 'current'
//   const [data, setData] = useState([]);
//   const [analysis, setAnalysis] = useState(null);
//   const [loading, setLoading] = useState(true);

//   // REPLACE WITH YOUR PC'S LOCAL IP (e.g., http://192.168.1.15:8000)
//   const API_URL = `http://172.16.23.234:8000/api/health-stats/${selectedWeek}`;

//   useEffect(() => {
//     fetchData();
//   }, [selectedWeek]);

//   const fetchData = async () => {
//     setLoading(true);
//     try {
//       const response = await axios.get(API_URL);
//       setData(response.data.raw_data);
//       setAnalysis(response.data.analysis);
//     } catch (error) {
//       console.error("API Error:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const renderMetricChart = (title, values, color) => (
//     <View style={styles.chartCard}>
//       <Text style={styles.chartTitle}>{title}</Text>
//       <LineChart
//         data={{
//           labels: data.map(d => d.Date.split('-')[2]), // Show Day (e.g., '06')
//           datasets: [{ data: values }]
//         }}
//         width={screenWidth - 40}
//         height={180}
//         chartConfig={{
//           backgroundColor: "#1E1E1E",
//           backgroundGradientFrom: "#1E1E1E",
//           backgroundGradientTo: "#1E1E1E",
//           decimalPlaces: 0,
//           color: (opacity = 1) => color(opacity),
//           labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
//           style: { borderRadius: 16 },
//           propsForDots: { r: "4", strokeWidth: "2", stroke: color(1) }
//         }}
//         bezier
//         style={{ marginVertical: 8, borderRadius: 16 }}
//       />
//     </View>
//   );

//   if (loading) {
//     return (
//       <View style={styles.loader}>
//         <ActivityIndicator size="large" color="#BB86FC" />
//       </View>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
//         <Text style={styles.header}>Agiless Health</Text>

//         {/* Filter UI */}
//         <View style={styles.filterContainer}>
//           {['past', 'current'].map((week) => (
//             <TouchableOpacity 
//               key={week}
//               style={[styles.filterBtn, selectedWeek === week && styles.activeBtn]}
//               onPress={() => setSelectedWeek(week)}
//             >
//               <Text style={[styles.filterText, selectedWeek === week && { color: '#FFF' }]}>
//                 {week.toUpperCase()} WEEK
//               </Text>
//             </TouchableOpacity>
//           ))}
//         </View>

//         {/* Random Forest Analysis Card */}
//         <View style={[styles.riskCard, { borderColor: analysis?.verdict === 'HIGH RISK' ? '#FF5252' : '#4CAF50' }]}>
//           <View style={styles.cardHeaderRow}>
//             <Text style={styles.riskLabel}>RANDOM FOREST ANALYSIS</Text>
//             <View style={[styles.badge, { backgroundColor: analysis?.verdict === 'HIGH RISK' ? '#FF5252' : '#4CAF50' }]}>
//               <Text style={styles.badgeText}>{analysis?.verdict}</Text>
//             </View>
//           </View>
          
//           <RiskBar label="Heart Health" percentage={analysis?.heartProb || 0} />
//           <RiskBar label="Obesity Risk" percentage={analysis?.obesityProb || 0} />
//           <RiskBar label="Respiratory Risk" percentage={analysis?.respProb || 0} />
//         </View>

//         {/* Metric Charts */}
//         {renderMetricChart("Heart Rate (BPM)", data.map(d => d['Heart Rate']), (op) => `rgba(0, 200, 255, ${op})`)}
//         {renderMetricChart("Sleep Duration (Hrs)", data.map(d => d['Sleep Duration']), (op) => `rgba(187, 134, 252, ${op})`)}
//         {renderMetricChart("Daily Steps", data.map(d => d['Daily Steps']), (op) => `rgba(3, 218, 198, ${op})`)}

//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 20 },
//   header: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginVertical: 20 },
//   loader: { flex: 1, backgroundColor: '#121212', justifyContent: 'center' },
//   filterContainer: { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 4, marginBottom: 20 },
//   filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
//   activeBtn: { backgroundColor: '#3700B3' },
//   filterText: { color: '#888', fontWeight: 'bold' },
//   riskCard: { padding: 20, borderRadius: 20, borderWidth: 1.5, backgroundColor: '#1E1E1E', marginBottom: 25 },
//   cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
//   badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
//   badgeText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
//   riskLabel: { color: '#AAA', fontSize: 12, fontWeight: '600' },
//   riskBarContainer: { marginBottom: 15 },
//   riskBarLabel: { color: '#DDD', fontSize: 14 },
//   riskBarValue: { fontSize: 14, fontWeight: 'bold' },
//   barTrack: { height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
//   barFill: { height: '100%', borderRadius: 4 },
//   chartCard: { backgroundColor: '#1E1E1E', borderRadius: 20, padding: 10, marginBottom: 20 },
//   chartTitle: { color: '#FFF', fontSize: 16, marginLeft: 10, marginTop: 5 }
// });
import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Dimensions, ActivityIndicator, SafeAreaView, StatusBar 
} from 'react-native';
import axios from 'axios';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get("window").width;

// --- Interfaces ---
interface HealthRecord {
  Date: string;
  Age: number;
  'Sleep Duration': number;
  'Quality of Sleep': number;
  'Heart Rate': number;
  'Daily Steps': number;
}

interface RiskAnalysis {
  heartProb: number;
  obesityProb: number;
  respProb: number;
  verdict: 'LOW RISK' | 'HIGH RISK';
  riskFactors: string[];
}

interface ApiResponse {
  raw_data: HealthRecord[];
  analysis: RiskAnalysis;
}

// --- Responsive Risk Bar Component ---
const RiskBar: React.FC<{ label: string; percentage: number }> = ({ label, percentage }) => {
  const getBarColor = (perc: number) => {
    if (perc < 30) return '#4CAF50'; 
    if (perc < 70) return '#FFB300'; 
    return '#FF5252';                
  };

  return (
    <View style={styles.riskBarContainer}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={styles.riskBarLabel}>{label}</Text>
        <Text style={[styles.riskBarValue, { color: getBarColor(percentage) }]}>
          {percentage}%
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: getBarColor(percentage) }]} />
      </View>
    </View>
  );
};

// --- Main Dashboard ---
export default function HealthDashboard() {
  const [selectedWeek, setSelectedWeek] = useState<'past' | 'current'>('current');
  const [data, setData] = useState<HealthRecord[]>([]);
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Use your local IP for physical devices, or 10.0.2.2 for Android Emulator
  const API_URL = `http://10.67.77.22:9000/api/health-stats/${selectedWeek}`;

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get<ApiResponse>(API_URL);
      setData(response.data.raw_data);
      setAnalysis(response.data.analysis);
    } catch (error) {
      console.error("FastAPI Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWeek]);

  const renderMetricChart = (title: string, values: number[], color: (opacity: number) => string) => {
    if (data.length === 0) return null;

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{title}</Text>
        <LineChart
          data={{
            // SPLIT LOGIC: Takes the "06" from "2026-02-06"
            labels: data.map(d => d.Date.split('-')[2]), 
            datasets: [{ data: values, strokeWidth: 3 }]
          }}
          width={screenWidth - 40} 
          height={220}
          chartConfig={{
            backgroundColor: "#1E1E1E",
            backgroundGradientFrom: "#1E1E1E",
            backgroundGradientTo: "#1E1E1E",
            decimalPlaces: 0,
            color: color,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            propsForLabels: { fontSize: 10 },
            propsForDots: { r: "5", strokeWidth: "2", stroke: color(1) },
            propsForBackgroundLines: {
                strokeDasharray: "5, 5",
                strokeWidth: 1,
                stroke: "rgba(255, 255, 255, 0.1)"
            }
          }}
          bezier
          style={styles.chartStyle}
          withInnerLines={true}
          withVerticalLines={false}
          segments={5}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#BB86FC" />
        <Text style={{color: '#888', marginTop: 10}}>Running Random Forest...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.header}>Agiless Analytics</Text>

        {/* Filter Toggle */}
        <View style={styles.filterContainer}>
          {(['past', 'current'] as const).map((week) => (
            <TouchableOpacity 
              key={week}
              style={[styles.filterBtn, selectedWeek === week && styles.activeBtn]}
              onPress={() => setSelectedWeek(week)}
            >
              <Text style={[styles.filterText, selectedWeek === week && { color: '#FFF' }]}>
                {week.toUpperCase()} WEEK
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* AI Risk Analysis Card */}
        <View style={[styles.riskCard, { borderColor: analysis?.verdict === 'HIGH RISK' ? '#FF5252' : '#4CAF50' }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.riskLabel}>AI RISK PREDICTION</Text>
            <View style={[styles.badge, { backgroundColor: analysis?.verdict === 'HIGH RISK' ? '#FF5252' : '#4CAF50' }]}>
              <Text style={styles.badgeText}>{analysis?.verdict}</Text>
            </View>
          </View>
          
          <RiskBar label="Heart Wellness" percentage={analysis?.heartProb || 0} />
          <RiskBar label="Obesity Index" percentage={analysis?.obesityProb || 0} />
          <RiskBar label="Respiratory Score" percentage={analysis?.respProb || 0} />
        </View>

        {/* Responsive Graphs */}
        {renderMetricChart("Heart Rate Trend", data.map(d => d['Heart Rate']), (op) => `rgba(0, 200, 255, ${op})`)}
        {renderMetricChart("Sleep Patterns", data.map(d => d['Sleep Duration']), (op) => `rgba(187, 134, 252, ${op})`)}
        {renderMetricChart("Activity (Steps)", data.map(d => d['Daily Steps']), (op) => `rgba(3, 218, 198, ${op})`)}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingHorizontal: 20 },
  header: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginVertical: 20 },
  loader: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  filterContainer: { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 4, marginBottom: 25 },
  filterBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  activeBtn: { backgroundColor: '#3700B3' },
  filterText: { color: '#888', fontWeight: 'bold', fontSize: 13 },
  riskCard: { padding: 20, borderRadius: 24, borderWidth: 1.5, backgroundColor: '#1E1E1E', marginBottom: 25 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  riskLabel: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  riskBarContainer: { marginBottom: 18 },
  riskBarLabel: { color: '#EEE', fontSize: 14, fontWeight: '500' },
  riskBarValue: { fontSize: 14, fontWeight: 'bold' },
  barTrack: { height: 10, backgroundColor: '#2A2A2A', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  chartCard: { backgroundColor: '#1E1E1E', borderRadius: 24, paddingVertical: 15, marginBottom: 20, alignItems: 'center' },
  chartTitle: { color: '#FFF', fontSize: 15, fontWeight: '600', alignSelf: 'flex-start', marginLeft: 15, marginBottom: 10 },
  chartStyle: { marginVertical: 8, borderRadius: 16 }
});