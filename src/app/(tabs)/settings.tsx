import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useFocusEffect } from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { successFeedback } from "../../lib/haptics";
import {
  cancelReminderAsync,
  getReminderPermissionStatus,
  isExpoGo,
  isSystemRemindersAvailable,
  requestReminderPermissions,
  scheduleDailyReminderAsync,
  scheduleReminderAsync,
} from "../../lib/reminders";
import { TimePicker } from "../../components/TimePicker";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  readSettings,
  type SettingsState,
} from "../../lib/settings";
import { loadHabits, saveHabits, STORAGE_KEYS } from "../../lib/storage";
import { ACCENTS, sizes, type AccentKey } from "../../styles/styles";
import { useAppTheme } from "../../theme";

const DATA_KEYS: Record<string, string> = {
  tasks: STORAGE_KEYS.habits,
  notes: STORAGE_KEYS.notes,
  streaks: STORAGE_KEYS.streaks,
};

const BACKUP_KEYS = [
  "habits",
  "notes",
  "streaks",
  "settings",
  "theme",
  "accent",
];

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

const formatHourMinute = (hour: number, minute: number) => {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
};

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onValueChange,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  sub?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowIcon}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsRowLabel}>{label}</Text>
        {sub ? <Text style={styles.settingsRowSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        thumbColor={value ? colors.text : "#fafafa"}
        trackColor={{ false: colors.surfaceAlt, true: colors.accent }}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, styles, mode, setMode, accentKey, setAccent } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + sizes.tabBarHeight + 24;
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  const [confirmTarget, setConfirmTarget] = useState<
    "tasks" | "notes" | "streaks" | null
  >(null);
  const [note, setNote] = useState<string | null>(null);

  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null,
  );

  const dailyQueueRef = useRef<Promise<void>>(Promise.resolve());

  const refreshPermission = useCallback(async () => {
    setPermissionGranted(await getReminderPermissionStatus());
  }, []);

  const loadSettingsSync = async () => {
    setSettings(await readSettings());
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const next = await readSettings();
      if (active) setSettings(next);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshPermission();
    }, [refreshPermission]),
  );

  const updateSetting = <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch((error) =>
        console.error("Failed to save settings", error),
      );
      return next;
    });
    setNote(null);
  };

  const persistSettings = async (next: SettingsState) => {
    setSettings(next);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch (error) {
      console.error("Failed to save settings", error);
    }
    setNote(null);
  };

  const toggleHaptics = async (value: boolean) => {
    const current = await readSettings();
    await persistSettings({ ...current, haptics: value });
    // Fire the confirming buzz only after the new value is persisted so the
    // haptics wrapper (which re-reads settings) sees it enabled.
    if (value) void successFeedback();
  };

  const applyDailyReminder = async (
    enabled: boolean,
    hour: number,
    minute: number,
  ) => {
    // Always read the latest settings so rapid toggles/time changes can't act
    // on a stale notification id (which would leave duplicate jobs behind).
    const current = await readSettings();
    await cancelReminderAsync(current.dailyNotificationId);
    if (!enabled) {
      await persistSettings({
        ...current,
        dailyReminders: false,
        dailyNotificationId: null,
      });
      return;
    }
    if (!isSystemRemindersAvailable()) {
      Alert.alert(
        "Dev build needed",
        "Daily reminders need system notifications, which aren't available in Expo Go. Use a development build for background alarms.",
      );
      return;
    }
    const granted = await requestReminderPermissions();
    void refreshPermission();
    if (!granted) {
      Alert.alert(
        "Notifications needed",
        "Allow notifications to get a daily check-in reminder.",
      );
      return;
    }
    const id = await scheduleDailyReminderAsync({
      title: "Tendo check-in",
      body: "Time to check your todos, notes and streaks.",
      hour,
      minute,
    });
    if (!id) {
      Alert.alert("Could not schedule", "Something went wrong. Try again.");
      return;
    }
    await persistSettings({
      ...current,
      dailyReminders: true,
      dailyHour: hour,
      dailyMinute: minute,
      dailyNotificationId: id,
    });
  };

  // Serialize daily-reminder changes so a burst of picker scrolls can never
  // leave more than one scheduled job (each run cancels the previous id).
  const queueDailyReminder = (
    enabled: boolean,
    hour: number,
    minute: number,
  ) => {
    dailyQueueRef.current = dailyQueueRef.current
      .catch(() => undefined)
      .then(() => applyDailyReminder(enabled, hour, minute));
  };

  const sendTestAlarm = async () => {
    if (!isSystemRemindersAvailable()) {
      setNote("System alarms unavailable — in-app test in 6 seconds.");
      setTimeout(() => {
        Alert.alert(
          "Tendo test alarm",
          "In-app alarms work while Tendo is open.",
        );
      }, 6000);
      return;
    }
    const granted = await requestReminderPermissions();
    void refreshPermission();
    if (!granted) {
      Alert.alert(
        "Notifications needed",
        "Allow notifications so the test alarm can ring.",
      );
      return;
    }
    const id = await scheduleReminderAsync({
      title: "Tendo test alarm",
      body: "If you got this, alarms work on your device.",
      timeMs: Date.now() + 6000,
    });
    setNote(
      id
        ? "Test alarm scheduled — look for it in a few seconds."
        : "Could not schedule the test alarm.",
    );
  };

  const clearCompleted = async () => {
    try {
      const stored = await loadHabits();
      for (const h of stored) {
        if (h.completedDate !== null && h.notificationId) {
          await cancelReminderAsync(h.notificationId);
        }
      }
      const remaining = stored.filter((h) => h.completedDate === null);
      await saveHabits(remaining);
      setNote(`Cleared ${stored.length - remaining.length} completed task(s).`);
    } catch (error) {
      console.error("Failed to clear completed tasks", error);
      setNote("Something went wrong while clearing.");
    }
  };

  const clearData = async () => {
    if (!confirmTarget) return;
    const key = DATA_KEYS[confirmTarget];
    try {
      await AsyncStorage.removeItem(key);
      setNote(`All ${confirmTarget} cleared.`);
    } catch (error) {
      console.error("Failed to clear data", error);
      setNote("Something went wrong while clearing.");
    } finally {
      setConfirmTarget(null);
    }
  };

  const collectBackup = async () => {
    const pairs = await AsyncStorage.multiGet(BACKUP_KEYS);
    const data: Record<string, unknown> = {};
    for (const [key, value] of pairs) {
      if (value) data[key] = JSON.parse(value);
    }
    return JSON.stringify(
      {
        app: "Tendo",
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        data,
      },
      null,
      2,
    );
  };

  const handleExport = async () => {
    try {
      const json = await collectBackup();
      const result = await Share.share({
        message: json,
        title: "Tendo backup",
      });
      if (result.action === Share.sharedAction) {
        setNote("Backup exported.");
      }
    } catch (error) {
      console.error("Failed to export backup", error);
      setNote("Could not export the backup.");
    }
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(importText) as {
        data?: Record<string, unknown>;
      } & Record<string, unknown>;
      const source = parsed.data ?? parsed;

      const entries: [string, string][] = [];
      for (const key of BACKUP_KEYS) {
        if (source[key] !== undefined) {
          entries.push([key, JSON.stringify(source[key])]);
        }
      }

      if (entries.length === 0) {
        setImportError("No recognized Tendo data found in the backup.");
        return;
      }

      await AsyncStorage.multiSet(entries);

      const themeValue = source.theme;
      if (themeValue === "dark" || themeValue === "light") {
        setMode(themeValue);
      }

      const accentValue = source.accent;
      if (typeof accentValue === "string" && ACCENTS.some((a) => a.key === accentValue)) {
        setAccent(accentValue as AccentKey);
      }

      setImportVisible(false);
      setImportText("");
      setImportError(null);
      setNote("Backup imported.");
      await loadSettingsSync();
    } catch (error) {
      console.error("Failed to import backup", error);
      setImportError("That doesn't look like valid backup JSON.");
    }
  };

  const alarmStatus = !isSystemRemindersAvailable()
    ? isExpoGo()
      ? "In-app only (Expo Go)"
      : "Unavailable here"
    : permissionGranted === false
      ? "Notifications off"
      : "System alarms on";

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.settingsListContent,
          { paddingBottom: bottomPad },
        ]}
      >
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Theme</Text>
          <View style={styles.settingsCard}>
            <ToggleRow
              icon="moon-outline"
              label="Dark mode"
              sub="Switch between light and dark"
              value={mode === "dark"}
              onValueChange={(dark) => setMode(dark ? "dark" : "light")}
            />
            <View style={styles.settingsRowDivider} />
            <View style={styles.settingsRow}>
              <View style={styles.settingsRowIcon}>
                <Ionicons name="color-palette-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsRowLabel}>Theme color</Text>
                <Text style={styles.settingsRowSub}>
                  {ACCENTS.find((a) => a.key === accentKey)?.label ?? "Blue"} · tints the whole app
                </Text>
              </View>
            </View>
            <View style={styles.accentSwatchRow}>
              {ACCENTS.map((preset) => {
                const swatch = mode === "dark" ? preset.dark : preset.light;
                const selected = preset.key === accentKey;
                return (
                  <Pressable
                    key={preset.key}
                    onPress={() => setAccent(preset.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`${preset.label} accent`}
                    accessibilityState={{ selected }}
                    style={[
                      styles.accentSwatch,
                      { backgroundColor: swatch },
                      selected && styles.accentSwatchSelected,
                    ]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={colors.onAccent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Behavior</Text>
          <View style={styles.settingsCard}>
            <ToggleRow
              icon="hand-left-outline"
              label="Haptic feedback"
              sub="Vibrate when checking things off"
              value={settings.haptics}
              onValueChange={(value) => void toggleHaptics(value)}
            />
            <View style={styles.settingsRowDivider} />
            <ToggleRow
              icon="alert-circle-outline"
              label="Confirm before deleting"
              sub="Ask before removing a todo, note or streak"
              value={settings.confirmDelete}
              onValueChange={(value) => updateSetting("confirmDelete", value)}
            />
            <View style={styles.settingsRowDivider} />
            <ToggleRow
              icon="calendar-outline"
              label="Week starts on Monday"
              sub="Used for streaks and weekly statistics"
              value={settings.weekStartsMonday}
              onValueChange={(value) =>
                updateSetting("weekStartsMonday", value)
              }
            />
            <View style={styles.settingsRowDivider} />
            <ToggleRow
              icon="notifications-outline"
              label="Daily reminders"
              sub={
                settings.dailyReminders
                  ? `Every day at ${formatHourMinute(settings.dailyHour, settings.dailyMinute)}`
                  : "Remind me to check in each day"
              }
              value={settings.dailyReminders}
              onValueChange={(value) =>
                queueDailyReminder(
                  value,
                  settings.dailyHour,
                  settings.dailyMinute,
                )
              }
            />
            {settings.dailyReminders ? (
              <View>
                <View style={styles.settingsRowDivider} />
                <View style={styles.settingsRow}>
                  <TimePicker
                    hour={
                      settings.dailyHour % 12 === 0
                        ? 12
                        : settings.dailyHour % 12
                    }
                    minute={settings.dailyMinute}
                    ampm={settings.dailyHour >= 12 ? "PM" : "AM"}
                    onChange={(h, m, ap) => {
                      const h24 =
                        ap === "AM" ? h % 12 : ((h % 12) + 12) % 24;
                      queueDailyReminder(true, h24, m);
                    }}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Notifications</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingsRow}>
              <View style={styles.settingsRowIcon}>
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.settingsRowLabel}>Alarm status</Text>
              <Text style={styles.statRowValue}>{alarmStatus}</Text>
            </View>
            <View style={styles.settingsRowDivider} />
            <Pressable style={styles.settingsRow} onPress={sendTestAlarm}>
              <View style={styles.settingsRowIcon}>
                <Ionicons
                  name="alarm-outline"
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.settingsRowLabel}>Send test alarm</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Data</Text>
          <View style={styles.settingsCard}>
            <Pressable style={styles.settingsRow} onPress={clearCompleted}>
              <View style={styles.settingsRowIcon}>
                <Ionicons
                  name="checkmark-done-outline"
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.settingsRowLabel}>Clear completed tasks</Text>
            </Pressable>
            <View style={styles.settingsRowDivider} />
            <Pressable
              style={styles.settingsRow}
              onPress={() => setConfirmTarget("tasks")}
            >
              <View style={styles.settingsRowIcon}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </View>
              <Text style={[styles.settingsRowLabel, styles.settingsRowDanger]}>
                Clear all tasks
              </Text>
            </Pressable>
            <View style={styles.settingsRowDivider} />
            <Pressable
              style={styles.settingsRow}
              onPress={() => setConfirmTarget("notes")}
            >
              <View style={styles.settingsRowIcon}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </View>
              <Text style={[styles.settingsRowLabel, styles.settingsRowDanger]}>
                Clear all notes
              </Text>
            </Pressable>
            <View style={styles.settingsRowDivider} />
            <Pressable
              style={styles.settingsRow}
              onPress={() => setConfirmTarget("streaks")}
            >
              <View style={styles.settingsRowIcon}>
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </View>
              <Text style={[styles.settingsRowLabel, styles.settingsRowDanger]}>
                Clear all streaks
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Backup</Text>
          <View style={styles.settingsCard}>
            <Pressable style={styles.settingsRow} onPress={handleExport}>
              <View style={styles.settingsRowIcon}>
                <Ionicons name="share-outline" size={20} color={colors.accent} />
              </View>
              <Text style={styles.settingsRowLabel}>Export data</Text>
            </Pressable>
            <View style={styles.settingsRowDivider} />
            <Pressable
              style={styles.settingsRow}
              onPress={() => {
                setImportError(null);
                setImportVisible(true);
              }}
            >
              <View style={styles.settingsRowIcon}>
                <Ionicons name="download-outline" size={20} color={colors.accent} />
              </View>
              <Text style={styles.settingsRowLabel}>Import data</Text>
            </Pressable>
          </View>
          {note && <Text style={styles.settingsNote}>{note}</Text>}
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>About</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingsRow}>
              <View style={styles.settingsRowIcon}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.settingsRowLabel}>Version</Text>
              <Text style={styles.statRowValue}>{APP_VERSION}</Text>
            </View>
            <View style={styles.settingsRowDivider} />
            <View style={styles.settingsRow}>
              <View style={styles.settingsRowIcon}>
                <Ionicons
                  name="flame-outline"
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.settingsRowLabel}>Tendo</Text>
              <Text style={styles.statRowValue}>Streak & notes</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={confirmTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setConfirmTarget(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {confirmTarget === "tasks"
                ? "Clear all tasks?"
                : confirmTarget === "notes"
                  ? "Clear all notes?"
                  : "Clear all streaks?"}
            </Text>
            <Text style={styles.modalBody}>
              This deletes every{" "}
              {confirmTarget === "tasks"
                ? "task"
                : confirmTarget === "notes"
                  ? "note"
                  : "streak"}{" "}
              in your app. This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalButton}
                onPress={() => setConfirmTarget(null)}
              >
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.dangerButton]}
                onPress={clearData}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={importVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setImportVisible(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Import backup</Text>
            <Text style={styles.modalBody}>
              Paste a Tendo backup JSON below to restore your data.
            </Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMultiline]}
              placeholder='Paste your backup JSON here...'
              placeholderTextColor={colors.muted}
              value={importText}
              onChangeText={setImportText}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            {importError && (
              <Text style={[styles.settingsNote, { marginBottom: 12 }]}>
                {importError}
              </Text>
            )}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalButton}
                onPress={() => setImportVisible(false)}
              >
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleImport}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                  Import
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}