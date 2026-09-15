import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { sizes } from "../../styles/styles";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "yellow",
        tabBarInactiveTintColor: "#8a8f98",
        tabBarStyle: {
          backgroundColor: "#1e2126",
          borderTopColor: "#33373d",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Todos",
          tabBarIcon: ({ color }) => (
            <Ionicons size={sizes.icon} name="checkbox-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: ({ color }) => (
            <Ionicons
              size={sizes.icon}
              name="document-text-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="streaks"
        options={{
          title: "Streaks",
          tabBarIcon: ({ color }) => (
            <Ionicons size={sizes.icon} name="flame-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: "Stats",
          tabBarIcon: ({ color }) => (
            <Ionicons
              size={sizes.icon}
              name="stats-chart-outline"
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <Ionicons size={sizes.icon} name="settings-outline" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
