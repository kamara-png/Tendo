import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "../../styles/styles";

type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
};

const STORAGE_KEY = "notes";

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function NotesScreen() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setNotes(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to load notes", error);
      }
    };
    loadNotes();
  }, []);

  useEffect(() => {
    const saveNotes = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      } catch (error) {
        console.error("Failed to save notes", error);
      }
    };
    saveNotes();
  }, [notes]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const createNote = () => {
    const note: Note = {
      id: Date.now().toString(),
      title: "",
      body: "",
      updatedAt: Date.now(),
    };
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
  };

  const updateSelected = (patch: Partial<Pick<Note, "title" | "body">>) => {
    if (!selectedId) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedId ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    );
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setNotes((prev) => prev.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  };

  const renderNote = ({ item }: { item: Note }) => (
    <TouchableOpacity
      onPress={() => setSelectedId(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.noteCard}>
        <Text style={styles.noteCardTitle} numberOfLines={1}>
          {item.title.trim() || "New Note"}
        </Text>
        <Text style={styles.noteCardPreview} numberOfLines={2}>
          {item.body.trim() || "No additional text"}
        </Text>
        <Text style={styles.noteCardDate}>{formatDate(item.updatedAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (selected) {
    return (
      <View style={styles.container}>
        <View style={styles.noteEditorContainer}>
          <View style={styles.noteEditorHeader}>
            <Pressable onPress={() => setSelectedId(null)} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color="yellow" />
            </Pressable>
            <Text style={styles.noteEditorHeaderTitle} numberOfLines={1}>
              Notes
            </Text>
            <Pressable onPress={deleteSelected} hitSlop={8}>
              <Ionicons name="trash" size={22} color="#e74c3c" />
            </Pressable>
          </View>

          <TextInput
            style={styles.noteEditorTitleInput}
            placeholder="Title"
            placeholderTextColor="#6b7280"
            value={selected.title}
            onChangeText={(title) => updateSelected({ title })}
            autoFocus={false}
          />
          <View style={styles.noteEditorDivider} />
          <TextInput
            style={styles.noteEditorBodyInput}
            placeholder="Start writing..."
            placeholderTextColor="#6b7280"
            value={selected.body}
            onChangeText={(body) => updateSelected({ body })}
            multiline
            textAlignVertical="top"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.noteHeader}>
        <Text style={styles.headerTitle}>Notes</Text>
        <Pressable style={styles.noteNewButton} onPress={createNote} hitSlop={8}>
          <Ionicons name="add" size={28} color="yellow" />
        </Pressable>
      </View>

      {notes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.stubText}>No notes yet</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.noteListContent}
          renderItem={renderNote}
        />
      )}
    </View>
  );
}