import { Drawer } from "expo-router/drawer";
import { Ionicons } from "@expo/vector-icons";

export default function Layout() {
  return (
    <Drawer
      screenOptions={{
        headerStyle: {
          backgroundColor: "#0f2027",
        },
        headerTintColor: "white",
        drawerStyle: {
          backgroundColor: "#1c2b36",
        },
        drawerActiveTintColor: "#00c6ff",
        drawerInactiveTintColor: "white",
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: "Dashboard",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="graph"
        options={{
          title: "Graph",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="analytics" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="ai"
        options={{
          title: "AI Assistant",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="records"
        options={{
          title: "Records",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="folder" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="stats"
        options={{
          title: "Stats",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="watch"
        options={{
          title: "Watch",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="watch" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="ingest"
        options={{
          title: "Upload",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="cloud-upload" size={size} color={color} />
          ),
        }}
      />

      <Drawer.Screen
        name="logout"
        options={{
          title: "Logout",
          drawerIcon: ({ color, size }) => (
            <Ionicons name="log-out" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}
