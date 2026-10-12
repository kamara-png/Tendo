import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { TimePicker, type AmPm } from "../../components/TimePicker";
import { colorForIndex } from "../../lib/colors";
import { todayKey } from "../../lib/dates";
import { tapFeedback } from "../../lib/haptics";
import { readSettings } from "../../lib/settings";
import {
  loadHabits,
  saveHabits,
  type Habit,
} from "../../lib/storage";
import {
  addReminderResponseListener,
  cancelReminderAsync,
  consumeLastReminderResponse,
  DISMISS_ALARM,
  isExpoGo,
  isSystemRemindersAvailable,
  requestReminderPermissions,
  scheduleReminderAsync,
  SNOOZE_60,
} from "../../lib/reminders";
import { sizes } from "../../styles/styles";
import { useAppTheme } from "../../theme";

const to24Hour = (hour12: number, ampm: AmPm) =>
  ampm === "AM" ? hour12 % 12 : (hour12 % 12) + 12;

const nextOccurrence = (hours: number, minutes: number) => {
  const now = new Date();
  const date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0,
  );
  if (date.getTime() <= now.getTime() + 30000) {
    date.setDate(date.getDate() + 1);
  }
  return date;
};

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

type HabitSection = {
  key: string;
  title: string;
  data: Habit[];
};

export default function Index() {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + sizes.tabBarHeight + 24;
  const [habits, setHabits] = useState<Habit[]>([]);

  const habitsRef = useRef<Habit[]>([]);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  const alertingRef = useRef(false);

  const dismissReminder = useCallback(async (habit: Habit) => {
    await cancelReminderAsync(habit.notificationId);
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id ? { ...h, reminderAt: null, notificationId: null } : h,
      ),
    );
  }, []);

  const snoozeHabit = useCallback(async (habit: Habit, minutes: number) => {
    await cancelReminderAsync(habit.notificationId);
    const timeMs = Date.now() + minutes * 60000;
    let notifId: string | null = null;
    if (isSystemRemindersAvailable()) {
      try {
        notifId = await scheduleReminderAsync({
          title: habit.name,
          body: "Your ck chime alarm is up — time for this todo.",
          timeMs,
          habitId: habit.id,
        });
      } catch (error) {
        console.error("Failed to snooze reminder", error);
      }
    }
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? { ...h, reminderAt: timeMs, notificationId: notifId }
          : h,
      ),
    );
  }, []);

  // Handles snooze/dismiss taps on a system alarm notification (dev/prod builds).
  useEffect(() => {
    const subscription = addReminderResponseListener((action, habitId) => {
      if (!habitId) return;
      const habit = habitsRef.current.find((h) => h.id === habitId);
      if (!habit) return;
      if (action === DISMISS_ALARM) {
        void dismissReminder(habit);
        return;
      }
      void snoozeHabit(habit, action === SNOOZE_60 ? 60 : 10);
    });
    return () => subscription?.remove();
  }, [snoozeHabit, dismissReminder]);

  useEffect(() => {
    const loadHabitsFromStorage = async () => {
      const mapped = await loadHabits();
      setHabits(mapped);

      for (const h of mapped) {
        if (
          h.reminderAt &&
          h.reminderAt > Date.now() &&
          !h.notificationId
        ) {
          try {
            const id = await scheduleReminderAsync({
              title: h.name,
              body: "Your ck chime alarm is up — time for this todo.",
              timeMs: h.reminderAt,
              habitId: h.id,
            });
            if (id) {
              setHabits((prev) =>
                prev.map((x) =>
                  x.id === h.id ? { ...x, notificationId: id } : x,
                ),
              );
            }
            // If id is null, system notifications are unavailable
            // (Expo Go / web). reminderAt is still kept so the in-app
            // fallback below can fire while the app is open.
          } catch (error) {
            console.error("Failed to reschedule reminder", error);
          }
        }
      }

      // If the app was launched by tapping "Snooze" on an alarm notification.
      const last = consumeLastReminderResponse();
      if (last?.habitId) {
        const habit = mapped.find((h) => h.id === last.habitId);
        if (habit) {
          if (last.action === DISMISS_ALARM) {
            void dismissReminder(habit);
          } else {
            void snoozeHabit(habit, last.action === SNOOZE_60 ? 60 : 10);
          }
        }
      }
    };
    loadHabitsFromStorage();
  }, [snoozeHabit, dismissReminder]);

  useEffect(() => {
    void saveHabits(habits);
  }, [habits]);

  // In-app fallback: fires while the app is open when system notifications
  // are unavailable (Expo Go / web) or the app is in the foreground.
  // System notifications still handle the background case in dev/prod builds.
  useEffect(() => {
    const timer = setInterval(() => {
      if (alertingRef.current) return;
      const now = Date.now();
      // Only fall back in-app when no system notification was scheduled, so a
      // system alarm never also pops an in-app alert (no duplicates).
      const due = habits.find(
        (h) =>
          h.reminderAt &&
          h.reminderAt <= now &&
          h.completedDate === null &&
          !h.notificationId,
      );
      if (!due) return;
      alertingRef.current = true;
      Alert.alert(
        due.name,
        "Your ck chime alarm is up — time for this todo.",
        [
          {
            text: "Snooze 10 min",
            onPress: () => {
              alertingRef.current = false;
              void snoozeHabit(due, 10);
            },
          },
          {
            text: "Snooze 1 hour",
            onPress: () => {
              alertingRef.current = false;
              void snoozeHabit(due, 60);
            },
          },
          {
            text: "Dismiss",
            style: "cancel",
            onPress: () => {
              alertingRef.current = false;
              void dismissReminder(due);
            },
          },
        ],
        {
          cancelable: false,
          onDismiss: () => {
            alertingRef.current = false;
          },
        },
      );
    }, 15000);
    return () => clearInterval(timer);
  }, [habits, snoozeHabit, dismissReminder]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");

  const [alarmHabit, setAlarmHabit] = useState<Habit | null>(null);
  const [pickHour, setPickHour] = useState(9);
  const [pickMin, setPickMin] = useState(0);
  const [pickAmPm, setPickAmPm] = useState<AmPm>("AM");

  const openAlarmModal = (habit: Habit) => {
    const base = habit.reminderAt ? new Date(habit.reminderAt) : new Date();
    const h24 = base.getHours();
    setPickHour(h24 % 12 === 0 ? 12 : h24 % 12);
    setPickMin(base.getMinutes());
    setPickAmPm(h24 >= 12 ? "PM" : "AM");
    setAlarmHabit(habit);
  };

  const pickedDate = nextOccurrence(to24Hour(pickHour, pickAmPm), pickMin);
  const pickedLabel = `${pickedDate.getDate() !== new Date().getDate() ? "Tomorrow" : "Today"} at ${formatTime(pickedDate.getTime())}`;

  const confirmAlarm = () => {
    if (!alarmHabit) return;
    void applyReminder(
      alarmHabit,
      nextOccurrence(to24Hour(pickHour, pickAmPm), pickMin).getTime(),
    );
  };

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
    void tapFeedback();
    if (editingId === null) {
      const newHabit: Habit = {
        id: Date.now().toString(),
        name: inputText.trim(),
        completedDate: null,
        createdAt: Date.now(),
        reminderAt: null,
        notificationId: null,
      };
      setHabits((prev) => [newHabit, ...prev]);
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
    void tapFeedback();
    const today = todayKey();
    setHabits((prevHabits) =>
      prevHabits.map((habit) =>
        habit.id === id
          ? {
              ...habit,
              completedDate:
                habit.completedDate === today ? null : today,
            }
          : habit,
      ),
    );
  };

  const applyReminder = async (habit: Habit, timeMs: number | null) => {
    await cancelReminderAsync(habit.notificationId);

    if (timeMs === null) {
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id
            ? { ...h, reminderAt: null, notificationId: null }
            : h,
        ),
      );
      setAlarmHabit(null);
      return;
    }

    try {
      const systemAvailable = isSystemRemindersAvailable();
      let notifId: string | null = null;

      if (systemAvailable) {
        const granted = await requestReminderPermissions();
        if (!granted) {
          Alert.alert(
            "Notifications needed",
            isExpoGo()
              ? "System alarms need a development build. The reminder is still saved and will alert in-app while Tendo is open."
              : "Allow notifications so ck chime alarms can ring for your todos.",
          );
          // Still save the time so the in-app fallback works.
          setHabits((prev) =>
            prev.map((h) =>
              h.id === habit.id
                ? { ...h, reminderAt: timeMs, notificationId: null }
                : h,
            ),
          );
          setAlarmHabit(null);
          return;
        }
        notifId = await scheduleReminderAsync({
          title: habit.name,
          body: "Your ck chime alarm is up — time for this todo.",
          timeMs,
          habitId: habit.id,
        });
      }

      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id
            ? { ...h, reminderAt: timeMs, notificationId: notifId }
            : h,
        ),
      );
      if (!systemAvailable) {
        Alert.alert(
          "Reminder saved (in-app only)",
          isExpoGo()
            ? "You're in Expo Go, so no system notification was scheduled. Keep Tendo open and it will alert you in-app. Use a dev build (eas build --profile development) for background alarms with sound."
            : "System notifications are unavailable here, so this will alert in-app while Tendo is open.",
        );
      }
      setAlarmHabit(null);
    } catch (error) {
      console.error("Failed to set alarm", error);
      Alert.alert("Could not set alarm", "Something went wrong. Try again.");
    }
  };

  const removeHabit = (id: string) => {
    const index = habits.findIndex((h) => h.id === id);
    if (index === -1) return;

    const habit = habits[index];
    void cancelReminderAsync(habit.notificationId);

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
    }, 5000);
  };

  const deleteHabit = async (id: string) => {
    const { confirmDelete } = await readSettings();
    if (!confirmDelete) {
      removeHabit(id);
      return;
    }
    Alert.alert("Delete todo?", "This will remove it from your list.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeHabit(id) },
    ]);
  };

  const undoDelete = () => {
    if (!deleted) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);

    // The reminder/notification was already cancelled on delete, so a
    // restored habit must not keep a phantom "alarm set" that never fires.
    const restored: Habit = {
      ...deleted.habit,
      reminderAt: null,
      notificationId: null,
    };

    setHabits((prev) => {
      const next = [...prev];
      next.splice(deleted.index, 0, restored);
      return next;
    });

    Animated.timing(toastOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setDeleted(null));
  };

  const sections = useMemo<HabitSection[]>(() => {
    const today = todayKey();
    const active = habits.filter((h) => h.completedDate === null);
    const doneToday = habits.filter((h) => h.completedDate === today);

    const sorted = [...active].sort((a, b) => b.createdAt - a.createdAt);
    const byDay = new Map<string, Habit[]>();
    for (const habit of sorted) {
      const key = new Date(habit.createdAt).toDateString();
      const existing = byDay.get(key);
      if (existing) existing.push(habit);
      else byDay.set(key, [habit]);
    }

    const mainSections = Array.from(byDay.entries()).map(([key, data]) => ({
      key,
      title: new Date(data[0].createdAt).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      data,
    }));

    if (doneToday.length > 0) {
      mainSections.push({
        key: "done-today",
        title: "Done today",
        data: [...doneToday].sort((a, b) => b.createdAt - a.createdAt),
      });
    }

    return mainSections;
  }, [habits]);

  const renderHabit = ({ item, index }: { item: Habit; index: number }) => {
    const checked = item.completedDate === todayKey();
    return (
    <View style={styles.habitRow}>
      <Pressable
        style={styles.habitTick}
        onPress={() => toggleHabit(item.id)}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={item.name}
      >
        <Ionicons
          name={checked ? "checkmark-circle" : "ellipse-outline"}
          size={sizes.icon}
          color={colorForIndex(index, colors.palette)}
        />
      </Pressable>
      <Pressable
        style={styles.habitTextBlock}
        onPress={() => toggleHabit(item.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Toggle ${item.name}`}
      >
        <Text style={styles.habitName}>{item.name}</Text>
        {item.reminderAt ? (
          <Text style={styles.habitReminderText}>
            Alarm at {formatTime(item.reminderAt)}
            {item.notificationId ? "" : " (in-app only)"}
          </Text>
        ) : null}
      </Pressable>

      <Pressable
        style={styles.editButton}
        onPress={() => openAlarmModal(item)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Set alarm for ${item.name}`}
      >
        <Ionicons
          name={item.reminderAt ? "alarm" : "alarm-outline"}
          size={20}
          color={item.reminderAt ? colors.accent : colors.muted}
        />
      </Pressable>

      <Pressable
        style={styles.editButton}
        onPress={() => openEditModal(item.id, item.name)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.name}`}
      >
        <Ionicons name="create" size={20} color={colors.muted} />
      </Pressable>

      <Pressable
        style={styles.deleteButton}
        onPress={() => deleteHabit(item.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.name}`}
      >
        <Ionicons name="trash" size={20} color={colors.danger} />
      </Pressable>
    </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: HabitSection }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>{"To do's"}</Text>
        <View style={styles.headerSide}>
          <Pressable
            onPress={openAddModal}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Add todo"
          >
            <Ionicons name="add" size={28} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderHabit}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.stubText}>No todos yet</Text>
          </View>
        }
      />

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
              placeholder="What shall we do today boss?"
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
        visible={alarmHabit !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAlarmHabit(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAlarmHabit(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set alarm</Text>
            <Text style={styles.reminderCurrent}>{alarmHabit?.name}</Text>
            <TimePicker
              hour={pickHour}
              minute={pickMin}
              ampm={pickAmPm}
              onChange={(h, m, ap) => {
                setPickHour(h);
                setPickMin(m);
                setPickAmPm(ap);
              }}
            />
            <Text style={[styles.reminderCurrent, { marginTop: 12 }]}>
              Rings {pickedLabel}
              {alarmHabit?.reminderAt
                ? ` (currently ${formatTime(alarmHabit.reminderAt)})`
                : ""}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalButton}
                onPress={() => setAlarmHabit(null)}
              >
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={confirmAlarm}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                  Set alarm
                </Text>
              </Pressable>
            </View>
            {alarmHabit?.reminderAt ? (
              <Pressable
                style={[styles.modalButton, styles.reminderRemoveButton]}
                onPress={() => alarmHabit && applyReminder(alarmHabit, null)}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                  Remove alarm
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
