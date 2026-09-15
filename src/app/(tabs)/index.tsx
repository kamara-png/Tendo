import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { sizes, styles } from "../../styles/styles";

type Habit = {
  id: string;
  name: string;
  completed: boolean;
};

const STORAGE_KEY = "habits";

export default function Index() {
  const [habits, setHabits] = useState<Habit[]>([]);

  useEffect(() => {
    const loadHabits = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setHabits(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to load habits", error);
      }
    };
    loadHabits();
  }, []);

  useEffect(() => {
    const saveHabits = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
      } catch (error) {
        console.error("Failed to save habits", error);
      }
    };
    saveHabits();
  }, [habits]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");

  const [deleted, setDeleted] = useState<{
    habit: Habit;
    index: number;
  } | null>(null);
  const [toastOpacity] = useState(() => new Animated.Value(0));
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setInputText("");
    setModalVisible(true);
  };

  const openEditModal = (id: string, currentName: string) => {
    setEditingId(id);
    setInputText(currentName);
    setModalVisible(true);
  };

  const onSave = () => {
    if (!inputText.trim()) return;
    if (editingId === null) {
      setHabits((prev) => [
        ...prev,
        { id: Date.now().toString(), name: inputText.trim(), completed: false },
      ]);
    } else {
      setHabits((prev) =>
        prev.map((h) =>
          h.id === editingId ? { ...h, name: inputText.trim() } : h,
        ),
      );
    }
    setModalVisible(false);
  };

  const toggleHabit = (id: string) => {
    setHabits((prevHabits) =>
      prevHabits.map((habit) =>
        habit.id === id ? { ...habit, completed: !habit.completed } : habit,
      ),
    );
  };

  const deleteHabit = (id: string) => {
    const index = habits.findIndex((h) => h.id === id);
    if (index === -1) return;

    const habit = habits[index];

    setHabits((prev) => prev.filter((h) => h.id !== id));

    setDeleted({ habit, index });

    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    if (undoTimer.current) clearTimeout(undoTimer.current);

    undoTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setDeleted(null);
      });
    }, 1000);
  };

  const undoDelete = () => {
    if (!deleted) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);

    setHabits((prev) => {
      const next = [...prev];
      next.splice(deleted.index, 0, deleted.habit);
      return next;
    });

    Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setDeleted(null));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>To do's</Text>
      </View>

      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => toggleHabit(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.habitRow}>
              <Ionicons
                name={item.completed ? "checkmark-circle" : "ellipse-outline"}
                size={sizes.icon}
                color={item.completed ? "yellow" : "white"}
              />
              <Text style={styles.habitName}>{item.name}</Text>

              <Pressable
                style={styles.editButton}
                onPress={() => openEditModal(item.id, item.name)}
                hitSlop={8}
              >
                <Ionicons name="create" size={20} color="#8a8f98" />
              </Pressable>

              <Pressable
                style={styles.deleteButton}
                onPress={() => deleteHabit(item.id)}
                hitSlop={8}
              >
                <Ionicons name="trash" size={20} color="#e74c3c" />
              </Pressable>
            </View>
          </TouchableOpacity>
        )}
      />

      <Pressable style={styles.fab} onPress={openAddModal}>
        <Ionicons name="add" size={30} color="#25292e" />
      </Pressable>

      {deleted && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <Text style={styles.toastText}>Habit deleted</Text>
          <Pressable onPress={undoDelete} hitSlop={8}>
            <Text style={styles.toastUndo}>Undo</Text>
          </Pressable>
        </Animated.View>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingId === null ? "Add Todo" : "Edit Todo"}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="What shall we do today?"
              placeholderTextColor="#6b7280"
              value={inputText}
              onChangeText={setInputText}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={onSave}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
