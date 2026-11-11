import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  isSystemRemindersAvailable,
  requestReminderPermissions,
  setupNotificationsAsync,
} from "../lib/reminders";
import { readSettings, writeSettings } from "../lib/settings";
import { fonts } from "../styles/styles";
import {
  appUpdatesSupported,
  checkForUpdates,
  dismissUpdatePrompt,
  hydrateUpdateCache,
  installedVersion,
  startUpdate,
  useAppUpdate,
} from "../lib/useAppUpdate";
import { ThemeProvider, useAppTheme } from "../theme";

SplashScreen.preventAutoHideAsync();

function UpdatePromptModal() {
  const { colors, styles } = useAppTheme();
  const update = useAppUpdate();
  const open = appUpdatesSupported && update.promptOpen && update.release;
  if (!open || !update.release) return null;

  const downloading = update.phase === "downloading";
  const installing = update.phase === "installing";

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            Update to {update.release.version}
          </Text>
          <Text style={styles.modalBody}>
            {"You have " + installedVersion() + ". Here's what's new:"}
          </Text>
          {update.release.notes ? (
            <ScrollView
              style={{ maxHeight: 220 }}
              contentContainerStyle={{ paddingBottom: 4 }}
            >
              <Text style={styles.updateNotes}>{update.release.notes}</Text>
            </ScrollView>
          ) : null}
          {update.error ? (
            <Text style={[styles.settingsNote, { marginBottom: 8 }]}>
              {update.error}
            </Text>
          ) : null}
          {downloading ? (
            <View style={styles.updateProgressTrack}>
              <View
                style={[
                  styles.updateProgressFill,
                  { width: `${update.progress}%` },
                ]}
              />
            </View>
          ) : null}
          <View style={[styles.modalActions, { marginTop: 16 }]}>
            <Pressable
              style={styles.modalButton}
              onPress={() => void dismissUpdatePrompt()}
              disabled={downloading || installing}
            >
              <Text style={[styles.modalButtonText, styles.cancelButtonText]}>
                Later
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.saveButton]}
              onPress={() => void startUpdate()}
              disabled={downloading || installing}
            >
              {downloading || installing ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                  Update
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RootContent() {
  const { mode, colors, styles } = useAppTheme();
  const [introVisible, setIntroVisible] = useState(false);

  useEffect(() => {
    void (async () => {
      await setupNotificationsAsync();
      try {
        const settings = await readSettings();
        if (!settings.introSeen) {
          setIntroVisible(true);
          if (isSystemRemindersAvailable()) {
            void requestReminderPermissions();
          }
        }
      } catch (error) {
        console.error("Failed to read settings", error);
      }
    })();
  }, []);

  // Tripwire-style launch check: at most once a day, silently. A newer cached
  // release shows instantly even offline; failures stay invisible here.
  useEffect(() => {
    void (async () => {
      await hydrateUpdateCache();
      await checkForUpdates();
    })();
  }, []);

  const dismissIntro = async () => {
    setIntroVisible(false);
    try {
      const current = await readSettings();
      await writeSettings({ ...current, introSeen: true });
    } catch (error) {
      console.error("Failed to mark intro as seen", error);
    }
  };

  const feature = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    body: string,
  ) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 10,
      }}
    >
      <Ionicons name={icon} size={24} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: fonts.bold,
            fontWeight: "700",
            fontSize: 16,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontFamily: fonts.regular,
            fontSize: 13,
            marginTop: 2,
          }}
        >
          {body}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: styles.container.backgroundColor },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />

      <Modal
        visible={introVisible}
        transparent
        animationType="fade"
        onRequestClose={() => void dismissIntro()}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Welcome to Tendo</Text>
            <Text style={styles.modalBody}>
              Your calm daily dashboard for the little things that add up.
            </Text>
            {feature(
              "checkbox",
              "To-dos with active set alarms",
              "Add tasks, set reminders, and check them off as you go.",
            )}
            <View
              style={{
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
              }}
            />
            {feature(
              "document-text",
              "Notes that autosave",
              "Write freely - every change saves itself.",
            )}
            <View
              style={{
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
              }}
            />
            {feature(
              "flame",
              "Streaks & stats",
              "Check in daily and watch your consistency grow.",
            )}
            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <Pressable
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => void dismissIntro()}
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>
                  Get started
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <UpdatePromptModal />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
