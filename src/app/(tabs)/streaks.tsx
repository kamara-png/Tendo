import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
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
import { sizes } from "../../styles/styles";
import { colorForIndex } from "../../lib/colors";
import { dayKey, todayKey } from "../../lib/dates";
import { successFeedback, tapFeedback } from "../../lib/haptics";
import { currentStreak, longestStreak } from "../../lib/streaks";
import { readSettings } from "../../lib/settings";
import {
  loadStreaks,
  saveStreaks,
  subscribeStorageChanges,
  type Streak,
} from "../../lib/storage";
import { useAppTheme } from "../../theme";

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SUNDAY_WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getWeekDays = (mondayStart: boolean) => {
  const today = new Date();
  const weekdayOffset = mondayStart
    ? (today.getDay() + 6) % 7
    : today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - weekdayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

export default function StreaksScreen() {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + sizes.tabBarHeight + 24;
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [weekStartsMonday, setWeekStartsMonday] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [menuStreakId, setMenuStreakId] = useState<string | null>(null);

  const weekDays = useMemo(
    () => getWeekDays(weekStartsMonday),
    [weekStartsMonday],
  );
  const weekLabels = weekStartsMonday ? WEEK_LABELS : SUNDAY_WEEK_LABELS;
  const today = todayKey();

  // Hero numbers, recomputed from the live streak state.
  const summary = useMemo(() => {
    const doneToday = streaks.filter((s) => s.checks.includes(today)).length;
    const bestCurrent = streaks.reduce(
      (max, s) => Math.max(max, currentStreak(s.checks)),
      0,
    );
    const totalCheckins = streaks.reduce((sum, s) => sum + s.checks.length, 0);
    return { doneToday, bestCurrent, totalCheckins };
  }, [streaks, today]);

  // Re-read the week-start preference whenever the tab gains focus so a change
  // in Settings is reflected without restarting the app.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const settings = await readSettings();
        if (active) setWeekStartsMonday(settings.weekStartsMonday);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    let active = true;
    const loadFromStorage = async () => {
      let stored: Streak[] = [];
      try {
        stored = await loadStreaks({ throwOnError: true });
      } catch (error) {
        console.error("Failed to load streaks", error);
        return;
      }
      if (!active) return;
      setStreaks((prev) => {
        if (prev.length === 0) return stored;
        const ids = new Set(prev.map((s) => s.id));
        return [...prev, ...stored.filter((s) => !ids.has(s.id))];
      });
      setLoaded(true);
    };
    void loadFromStorage();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void saveStreaks(streaks);
  }, [streaks, loaded]);

  // Reload when Settings clears or imports data so stale streaks can't resurrect.
  useEffect(
    () =>
      subscribeStorageChanges(() => {
        void (async () => {
          try {
            setStreaks(await loadStreaks({ throwOnError: true }));
          } catch (error) {
            console.error("Failed to reload streaks", error);
          }
        })();
      }),
    [],
  );

  const openAddModal = () => {
    setEditingId(null);
    setInputText("");
    setModalVisible(true);
  };

  const openEditModal = (id: string, currentName: string) => {
    setMenuStreakId(null);
    setEditingId(id);
    setInputText(currentName);
    setModalVisible(true);
  };

  const onSave = () => {
    if (!inputText.trim()) return;
    if (editingId === null) {
      const newStreak: Streak = {
        id: Date.now().toString(),
        name: inputText.trim(),
        checks: [],
      };
      setStreaks((prev) => [newStreak, ...prev]);
    } else {
      setStreaks((prev) =>
        prev.map((s) =>
          s.id === editingId ? { ...s, name: inputText.trim() } : s,
        ),
      );
    }
    setModalVisible(false);
  };

  const removeStreak = (id: string) => {
    setStreaks((prev) => prev.filter((s) => s.id !== id));
  };

  const deleteStreak = async (id: string) => {
    setMenuStreakId(null);
    const { confirmDelete } = await readSettings();
    if (!confirmDelete) {
      removeStreak(id);
      return;
    }
    Alert.alert("Delete streak?", "Its check-in history will be removed too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeStreak(id),
      },
    ]);
  };

  const toggleCheck = (id: string) => {
    const target = streaks.find((s) => s.id === id);
    const willCheck = target ? !target.checks.includes(today) : false;
    if (willCheck) void successFeedback();
    else void tapFeedback("light");
    setStreaks((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const has = s.checks.includes(today);
        return {
          ...s,
          checks: has ? s.checks.filter((c) => c !== today) : [...s.checks, today],
        };
      }),
    );
  };

  const menuStreak = streaks.find((s) => s.id === menuStreakId) ?? null;

  const renderStreak = ({ item, index }: { item: Streak; index: number }) => {
    const checkedToday = item.checks.includes(today);
    const itemColor = colorForIndex(index, colors.palette);
    const streakNow = currentStreak(item.checks);
    const bestEver = longestStreak(item.checks);
    const doneThisWeek = weekDays.filter((d) =>
      item.checks.includes(dayKey(d)),
    ).length;

    return (
      <View style={styles.streakCard}>
        <View style={styles.streakCardHeader}>
          <View
            style={[styles.streakBadge, { backgroundColor: itemColor }]}
            accessibilityLabel={`Current streak ${streakNow} days`}
          >
            <Text style={styles.streakBadgeText}>
              {streakNow > 99 ? "99+" : streakNow}
            </Text>
          </View>
          <View style={styles.streakTitleBlock}>
            <Text style={styles.streakTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.streakSubtitle} numberOfLines={1}>
              {bestEver > 0
                ? `Best ${bestEver} day${bestEver === 1 ? "" : "s"} · ${item.checks.length} check-in${item.checks.length === 1 ? "" : "s"}`
                : "No check-ins yet"}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void tapFeedback("medium");
              setMenuStreakId(item.id);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${item.name}`}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
          </Pressable>
        </View>

        <View
          style={styles.streakWeekBar}
          accessibilityLabel={`${doneThisWeek} of 7 days this week`}
        >
          <View
            style={[
              styles.streakWeekBarFill,
              { width: `${(doneThisWeek / 7) * 100}%`, backgroundColor: itemColor },
            ]}
          />
        </View>

        <View style={styles.streakWeek}>
          {weekDays.map((day, i) => {
            const key = dayKey(day);
            const done = item.checks.includes(key);
            const isFuture = day.getTime() > Date.now();
            const isToday = key === today;
            return (
              <Pressable
                key={i}
                style={styles.streakDay}
                onPress={() => setSelectedDay(key)}
                disabled={isFuture}
                hitSlop={4}
                accessibilityRole="button"
                accessibilityState={{ disabled: isFuture }}
                accessibilityLabel={`${weekLabels[i]} ${day.toLocaleDateString()}`}
              >
                <Text
                  style={[
                    styles.streakDayLabel,
                    isToday && styles.streakDayTodayLabel,
                  ]}
                >
                  {weekLabels[i]}
                </Text>
                <Ionicons
                  name={done ? "ellipse" : "ellipse-outline"}
                  size={18}
                  color={
                    done ? itemColor : isFuture ? colors.surfaceAlt : colors.muted
                  }
                />
                <Text style={styles.streakDayNumber}>{day.getDate()}</Text>
              </Pressable>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.streakCheckin,
            checkedToday && styles.streakCheckinActive,
            checkedToday && { backgroundColor: itemColor, borderColor: itemColor },
          ]}
          onPress={() => toggleCheck(item.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: checkedToday }}
          accessibilityLabel={
            checkedToday
              ? `${item.name} checked in today`
              : `Check in ${item.name} today`
          }
        >
          <Ionicons
            name={checkedToday ? "flame" : "flame-outline"}
            size={sizes.icon}
            color={checkedToday ? colors.onAccent : itemColor}
          />
          <Text
            style={[
              styles.streakCheckinText,
              checkedToday && styles.streakCheckinTextActive,
            ]}
          >
            {checkedToday ? "Checked in today" : "Check in today"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>Streaks</Text>
        <View style={styles.headerSide}>
          <Pressable
            onPress={openAddModal}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Add streak"
          >
            <Ionicons name="add" size={28} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      {streaks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.stubText}>No streaks yet</Text>
        </View>
      ) : (
        <FlatList
          data={streaks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          ListHeaderComponent={
            <View style={styles.streakSummaryRow}>
              <View style={styles.streakSummaryCard}>
                <Ionicons name="flame" size={16} color={colors.accent} />
                <Text style={styles.streakSummaryValue}>
                  {summary.bestCurrent}
                </Text>
                <Text style={styles.streakSummaryLabel}>Current best</Text>
              </View>
              <View style={styles.streakSummaryCard}>
                <Ionicons name="checkmark-done" size={16} color={colors.accent} />
                <Text style={styles.streakSummaryValue}>
                  {summary.doneToday}/{streaks.length}
                </Text>
                <Text style={styles.streakSummaryLabel}>Done today</Text>
              </View>
              <View style={styles.streakSummaryCard}>
                <Ionicons name="calendar" size={16} color={colors.accent} />
                <Text style={styles.streakSummaryValue}>
                  {summary.totalCheckins}
                </Text>
                <Text style={styles.streakSummaryLabel}>Check-ins</Text>
              </View>
            </View>
          }
          renderItem={renderStreak}
        />
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
              {editingId === null ? "Add Streak" : "Edit Streak"}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="What are you keeping up?"
              placeholderTextColor={colors.muted}
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

      <Modal
        visible={selectedDay !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDay(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedDay(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {(() => {
                if (!selectedDay) return "Check-ins";
                const [y, m, d] = selectedDay.split("-").map(Number);
                return new Date(y, m - 1, d).toLocaleDateString([], {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                });
              })()}
            </Text>
            <View style={styles.streakWeek}>
              {streaks.map((s) => {
                const done = selectedDay ? s.checks.includes(selectedDay) : false;
                return (
                  <View key={s.id} style={styles.streakDay}>
                    <Text style={styles.streakDayLabel} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Ionicons
                      name={done ? "ellipse" : "ellipse-outline"}
                      size={18}
                      color={done ? colors.accent : colors.muted}
                    />
                  </View>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => setSelectedDay(null)}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={menuStreak !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuStreakId(null)}
      >
        <View style={styles.noteMenuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMenuStreakId(null)}
            accessibilityRole="button"
            accessibilityLabel="Close streak menu"
          />
          {menuStreak ? (
            <View
              style={[
                styles.noteMenuSheet,
                { paddingBottom: insets.bottom + 16 },
              ]}
            >
              <View style={styles.noteMenuHandle} />

              <View style={styles.noteMenuPreview}>
                <Ionicons name="flame" size={20} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noteMenuTitle} numberOfLines={1}>
                    {menuStreak.name}
                  </Text>
                  <Text style={styles.noteMenuPreviewText} numberOfLines={1}>
                    {currentStreak(menuStreak.checks)} day
                    {currentStreak(menuStreak.checks) === 1 ? "" : "s"} current ·{" "}
                    {menuStreak.checks.length} check-in
                    {menuStreak.checks.length === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.noteMenuAction,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
                onPress={() => openEditModal(menuStreak.id, menuStreak.name)}
                accessibilityRole="button"
                accessibilityLabel="Rename streak"
              >
                <Ionicons name="create-outline" size={22} color={colors.accent} />
                <Text style={styles.noteMenuActionText}>Rename streak</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.noteMenuAction,
                  pressed && { backgroundColor: colors.surfaceAlt },
                ]}
                onPress={() => void deleteStreak(menuStreak.id)}
                accessibilityRole="button"
                accessibilityLabel="Delete streak"
              >
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={colors.danger}
                />
                <Text
                  style={[styles.noteMenuActionText, { color: colors.danger }]}
                >
                  Delete streak
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.noteMenuCancel,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => setMenuStreakId(null)}
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
