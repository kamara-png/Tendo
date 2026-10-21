import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
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
import { tapFeedback } from "../../lib/haptics";
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

/** Empty drafts are never written to storage. */
const hasContent = (note: Note) =>
  note.title.trim().length > 0 || note.body.trim().length > 0;

/** Wait this long after the last keystroke before writing to storage. */
const AUTOSAVE_DELAY_MS = 600;

type SaveStatus = "saved" | "pending" | "saving";

export default function NotesScreen() {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + sizes.tabBarHeight + 24;
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuNoteId, setMenuNoteId] = useState<string | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  const notesRef = useRef<Note[]>([]);
  const loadedRef = useRef(false);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const queuedRevisionRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    setSaveStatus("pending");
  }, []);

  // Write the latest notes to storage, cancelling any debounced write that is
  // still pending. Saves are chained so two flushes can never land out of order.
  const flushSave = useCallback((): Promise<void> => {
    if (!loadedRef.current) return Promise.resolve();
    if (revisionRef.current <= queuedRevisionRef.current) {
      return saveChainRef.current;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const revision = revisionRef.current;
    const snapshot = notesRef.current.filter(hasContent);
    queuedRevisionRef.current = revision;
    setSaveStatus("saving");

    const save = saveChainRef.current.then(() => saveNotes(snapshot));
    saveChainRef.current = save.catch(() => {});
    void save.then(() => {
      savedRevisionRef.current = revision;
      setSaveStatus(
        revisionRef.current === revision ? "saved" : "pending",
      );
    });
    return save;
  }, []);

  // Debounced autosave: every edit resets the timer, so storage only sees one
  // write after the user pauses typing.
  useEffect(() => {
    notesRef.current = notes;
    if (!loaded) return;
    if (revisionRef.current <= savedRevisionRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (revisionRef.current > savedRevisionRef.current) void flushSave();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [notes, loaded, flushSave]);

  // Flush when leaving the screen or backgrounding the app so nothing is lost.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active") void flushSave();
    });
    return () => {
      subscription.remove();
      void flushSave();
    };
  }, [flushSave]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
  const menuNote = notes.find((n) => n.id === menuNoteId) ?? null;

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

  // Closing the editor flushes any pending debounced write first. Empty
  // drafts are discarded instead of being left behind as "New Note" ghosts.
  const closeEditor = useCallback(() => {
    const current = notesRef.current.find((n) => n.id === selectedId);
    if (current && !hasContent(current)) {
      const next = notesRef.current.filter((n) => n.id !== selectedId);
      notesRef.current = next;
      setNotes(next);
    }
    void flushSave();
    setSelectedId(null);
  }, [flushSave, selectedId]);

  // Android hardware back closes the editor (after an autosave flush) instead
  // of leaving the app.
  useEffect(() => {
    if (!selectedId) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        closeEditor();
        return true;
      },
    );
    return () => subscription.remove();
  }, [selectedId, closeEditor]);

  const createNote = () => {
    const note: Note = {
      id: Date.now().toString(),
      title: "",
      body: "",
      updatedAt: Date.now(),
      pinned: false,
    };
    // Don't mark a blank draft dirty: adding a note alone must not write
    // anything to storage.
    setSaveStatus("saved");
    setNotes((prev) => [note, ...prev]);
    selectNote(note.id);
  };

  const updateSelected = (
    patch: Partial<Pick<Note, "title" | "body" | "pinned">>,
  ) => {
    if (!selectedId) return;
    markDirty();
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedId ? { ...n, ...patch, updatedAt: Date.now() } : n,
      ),
    );
  };

  const openNoteMenu = (id: string) => {
    void tapFeedback("medium");
    setMenuNoteId(id);
  };

  const closeNoteMenu = () => setMenuNoteId(null);

  const togglePinned = (id: string) => {
    const note = notesRef.current.find((n) => n.id === id);
    if (!note) return;
    markDirty();
    const next = notesRef.current.map((n) =>
      n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n,
    );
    notesRef.current = next;
    setNotes(next);
    closeNoteMenu();
    void flushSave();
  };

  const removeNote = (id: string) => {
    markDirty();
    const next = notesRef.current.filter((n) => n.id !== id);
    notesRef.current = next;
    setNotes(next);
    void flushSave();
  };

  const deleteNote = async (id: string) => {
    closeNoteMenu();
    const { confirmDelete } = await readSettings();
    if (!confirmDelete) {
      removeNote(id);
      return;
    }
    Alert.alert("Delete note?", "This note will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeNote(id) },
    ]);
  };

  const renderNote = ({ item, index }: { item: Note; index: number }) => (
    <TouchableOpacity
      onPress={() => selectNote(item.id)}
      onLongPress={() => openNoteMenu(item.id)}
      delayLongPress={450}
      activeOpacity={0.7}
      accessibilityHint="Long press for pin and delete options"
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
          <View
            style={[
              styles.noteEditorContainer,
              {
                paddingBottom: keyboardOpen
                  ? 0
                  : insets.bottom + sizes.tabBarHeight + 20,
              },
            ]}
          >
            <View style={styles.noteEditorHeader}>
              <Pressable
                onPress={closeEditor}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Save and go back to notes"
              >
                <Ionicons name="chevron-back" size={26} color={colors.accent} />
              </Pressable>
              <Text style={styles.noteEditorHeaderTitle} numberOfLines={1}>
                Notes
              </Text>
              <View style={styles.noteEditorHeaderActions}>
                <View
                  accessible
                  accessibilityLabel={
                    saveStatus === "saved"
                      ? "All changes saved"
                      : saveStatus === "saving"
                        ? "Saving changes"
                        : "Unsaved changes"
                  }
                >
                  <Ionicons
                    name={saveStatus === "saved" ? "checkmark" : "save-outline"}
                    size={22}
                    color={
                      saveStatus === "saved" ? colors.accent : colors.muted
                    }
                  />
                </View>
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

      <Modal
        visible={menuNote !== null}
        transparent
        animationType="fade"
        onRequestClose={closeNoteMenu}
      >
        <View style={styles.noteMenuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeNoteMenu}
            accessibilityRole="button"
            accessibilityLabel="Close note menu"
          />
          {menuNote ? (
            <View
              style={[
                styles.noteMenuSheet,
                { paddingBottom: insets.bottom + 16 },
              ]}
            >
              <View style={styles.noteMenuHandle} />

              <View style={styles.noteMenuPreview}>
                <Ionicons
                  name="document-text"
                  size={20}
                  color={colors.accent}
                />
                <View style={{ flex: 1 }}>
                  <View style={styles.noteMenuTitleRow}>
                    <Text style={styles.noteMenuTitle} numberOfLines={1}>
                      {menuNote.title.trim() || "New Note"}
                    </Text>
                    {menuNote.pinned ? (
                      <Ionicons name="pin" size={14} color={colors.accent} />
                    ) : null}
                  </View>
                  <Text style={styles.noteMenuPreviewText} numberOfLines={1}>
                    {previewText(menuNote.body) || "No additional text"}
                  </Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.noteMenuAction,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
                onPress={() => togglePinned(menuNote.id)}
                accessibilityRole="button"
                accessibilityLabel={menuNote.pinned ? "Unpin note" : "Pin note"}
              >
                <Ionicons
                  name={menuNote.pinned ? "pin" : "pin-outline"}
                  size={22}
                  color={colors.accent}
                />
                <Text style={styles.noteMenuActionText}>
                  {menuNote.pinned ? "Unpin note" : "Pin note"}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.noteMenuAction,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
                onPress={() => void deleteNote(menuNote.id)}
                accessibilityRole="button"
                accessibilityLabel="Delete note"
              >
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={colors.danger}
                />
                <Text
                  style={[styles.noteMenuActionText, { color: colors.danger }]}
                >
                  Delete note
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.noteMenuCancel,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={closeNoteMenu}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.noteMenuCancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
