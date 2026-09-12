import { Ionicons } from "@expo/vector-icons";
import { FlatList, Pressable, Text, View } from "react-native";
import { sizes, styles } from "../../styles/styles";

const HABITS = [
  { id: "1", name: "Take a shit", completed: false },
  { id: "2", name: "Drink liquor", completed: true },
  { id: "3", name: "Meditate with some weed", completed: false },
  { id: "4", name: "Workout with some ZYN", completed: false },
  { id: "5", name: "Grind on Fortnite", completed: true },
];

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today</Text>
        <Pressable style={styles.iconButton} onPress={() => {}}>
          <Ionicons
            name="document-text-outline"
            size={sizes.icon}
            color="white"
          />
        </Pressable>
      </View>

      <FlatList
        data={HABITS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.habitRow}>
            <Ionicons
              name={item.completed ? "checkmark-circle" : "ellipse-outline"}
              size={sizes.icon}
              color={item.completed ? "yellow" : "white"}
            />
            <Text style={styles.habitName}>{item.name}</Text>
          </View>
        )}
      />
    </View>
  );
}
