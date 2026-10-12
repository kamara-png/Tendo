import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colorForIndex } from "../../lib/colors";
import { readSettings } from "../../lib/settings";
import {
  loadNotes,
  saveNotes,
  subscribeStorageChanges,
  type Note,
} from "../../lib/storage";
import { sizes } from "../../styles/styles";
import { useAppTheme } from "../../theme";

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Collapse whitespace for a single-line list preview. */
const previewText = (text: string) => text.replace(/\s+/g, " ").trim();

export default function NotesScreen() {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + sizes.tabBarHeight + 24;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let active = true;
    const loadNotesFromStorage = async () => {
      let stored: Note[] = [];
      try {
        stored = await loadNotes({ throwOnError: true });
      } catch (error) {
        console.error("Failed to load notes", error);
        return;
      }
      if (!active) return;
      setNotes((prev) => {
        if (prev.length === 0) return stored;
        const ids = new Set(prev.map((n) => n.id));
        return [...prev, ...stored.filter((n) => !ids.has(n.id))];
      });
      setLoaded(true);
    };
    void loadNotesFromStorage();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveNotes(notes);
  }, [notes, loaded]);

  // Reload when Settings clears or imports data so stale notes can't resurrect.
  useEffect(
    () =>
      subscribeStorageChanges(() => {
        void (async () => {
          try {
            setNotes(await loadNotes({ throwOnError: true }));
          } catch (error) {
            console.error("Failed to reload notes", error);
          }
        })();
      }),
    [],
  );

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const visibleNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = notes.filter((n) => {
      const matchesQuery =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q);
      return matchesQuery;
    });
    return filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [notes, searchQuery]);

  const toggleSearch = () => {
    if (searchVisible) setSearchQuery("");
    setSearchVisible((v) => !v);
  };

  const selectNote = (id: string | null) => {
    setSelectedId(id);
  };

  const createNote = () => {
    const note: Note = {
      id: Date.now().toString(),
      title: "",
      body: "",
      updatedAt: Date.now(),
      pinned: false,
    };
    setNotes((prev) => [note, ...prev]);
    selectNote(note.id);
  };

  const updateSelected = (
    patch: Partial<Pick<Note, "title" | "body" | "pinned">>,
  ) => {
    if (!selectedId) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedId ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    );
  };

  const togglePinned = () => {
    if (!selected) return;
    updateSelected({ pinned: !selected.pinned });
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setNotes((prev) => prev.filter((n) => n.id !== selectedId));
    setSelectedId(null);
  };

  const deleteSelected = async () => {
    if (!selectedId) return;
    const { confirmDelete } = await readSettings();
    if (!confirmDelete) {
      removeSelected();
      return;
    }
    Alert.alert("Delete note?", "This note will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: removeSelected },
    ]);
  };

  const renderNote = ({ item, index }: { item: Note; index: number }) => (
    <TouchableOpacity
      onPress={() => selectNote(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.noteCard}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Ionicons
            name="document-text"
            size={20}
            color={colorForIndex(index, colors.palette)}
            style={{ marginTop: 2 }}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.noteCardTitleRow}>
              <Text style={styles.noteCardTitle} numberOfLines={1}>
                {item.title.trim() || "New Note"}
              </Text>
              {item.pinned ? (
                <Ionicons name="pin" size={15} color={colors.accent} />
              ) : null}
            </View>
            <Text style={styles.noteCardPreview} numberOfLines={2}>
              {previewText(item.body) || "No additional text"}
            </Text>
            <Text style={styles.noteCardDate}>{formatDate(item.updatedAt)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (selected) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={styles.noteEditorContainer}>
            <View style={styles.noteEditorHeader}>
              <Pressable
                onPress={() => selectNote(null)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back to notes"
              >
                <Ionicons name="chevron-back" size={26} color={colors.accent} />
              </Pressable>
              <Text style={styles.noteEditorHeaderTitle} numberOfLines={1}>
                Notes
              </Text>
              <View style={styles.noteEditorHeaderActions}>
                <Pressable
                  onPress={togglePinned}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected.pinned }}
                  accessibilityLabel={
                    selected.pinned ? "Unpin note" : "Pin note"
                  }
                >
                  <Ionicons
                    name={selected.pinned ? "pin" : "pin-outline"}
                    size={22}
                    color={selected.pinned ? colors.accent : colors.muted}
                  />
                </Pressable>
                <Pressable
                  onPress={deleteSelected}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Delete note"
                >
                  <Ionicons name="trash" size={22} color={colors.danger} />
                </Pressable>
              </View>
            </View>

          <TextInput
            style={styles.noteEditorTitleInput}
            placeholder="Title"
            placeholderTextColor={colors.muted}
            value={selected.title}
            onChangeText={(title) => updateSelected({ title })}
            autoFocus={false}
          />
          <View style={styles.noteEditorDivider} />
          <TextInput
            style={styles.noteEditorBodyInput}
            placeholder="Start writing..."
            placeholderTextColor={colors.muted}
            value={selected.body}
            onChangeText={(body) => updateSelected({ body })}
            multiline
            textAlignVertical="top"
          />
          <Pressable
            style={[
              styles.modalButton,
              styles.saveButton,
              { alignItems: "center", marginTop: 12 },
            ]}
            onPress={() => selectNote(null)}
          >
            <Text style={[styles.modalButtonText, styles.saveButtonText]}>
              Save
            </Text>
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.headerSide, { width: 76 }]} />
        <Text style={styles.headerTitle}>Notes</Text>
        <View
          style={[
            styles.headerSide,
            { width: 76, flexDirection: "row", gap: 14 },
          ]}
        >
          <Pressable
            onPress={toggleSearch}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Search notes"
          >
            <Ionicons
              name={searchVisible ? "close" : "search"}
              size={24}
              color={colors.accent}
            />
          </Pressable>
          <Pressable
            onPress={createNote}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="New note"
          >
            <Ionicons name="add" size={28} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      {searchVisible ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 20,
            paddingBottom: 12,
          }}
        >
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
            placeholder="Search notes"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {notes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.stubText}>{"Let's create your first note"}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleNotes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.noteListContent,
            { paddingBottom: bottomPad },
          ]}
          renderItem={renderNote}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.stubText}>No matching notes</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
