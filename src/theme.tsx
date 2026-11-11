import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { STORAGE_KEYS } from "./lib/storage";
import {
  buildAccentTheme,
  createStyles,
  type AccentKey,
  type AppStyles,
  type ThemeColors,
  type ThemeStyle,
} from "./styles/styles";

const THEME_KEY = STORAGE_KEYS.theme;
const ACCENT_KEY = STORAGE_KEYS.accent;
const STYLE_KEY = STORAGE_KEYS.themeStyle;

export type ThemeMode = "dark" | "light";

type ThemeValue = {
  mode: ThemeMode;
  accentKey: AccentKey;
  style: ThemeStyle;
  colors: ThemeColors;
  styles: AppStyles;
  setMode: (mode: ThemeMode) => void;
  setAccent: (key: AccentKey) => void;
  setStyle: (style: ThemeStyle) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(
    systemScheme === "light" ? "light" : "dark",
  );
  const [accentKey, setAccentKey] = useState<AccentKey>("blue");
  const [style, setStyleState] = useState<ThemeStyle>("classic");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") setMode(stored);
      })
      .catch((error) => console.error("Failed to load theme", error));
    AsyncStorage.getItem(ACCENT_KEY)
      .then((stored) => {
        if (stored) setAccentKey(stored as AccentKey);
      })
      .catch((error) => console.error("Failed to load accent", error));
    AsyncStorage.getItem(STYLE_KEY)
      .then((stored) => {
        if (stored === "classic" || stored === "material") setStyleState(stored);
      })
      .catch((error) => console.error("Failed to load theme style", error));
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const apply = (next: ThemeMode) => {
      setMode(next);
      AsyncStorage.setItem(THEME_KEY, next).catch((error) =>
        console.error("Failed to save theme", error),
      );
    };
    const applyAccent = (key: AccentKey) => {
      setAccentKey(key);
      AsyncStorage.setItem(ACCENT_KEY, key).catch((error) =>
        console.error("Failed to save accent", error),
      );
    };
    const applyStyle = (next: ThemeStyle) => {
      setStyleState(next);
      AsyncStorage.setItem(STYLE_KEY, next).catch((error) =>
        console.error("Failed to save theme style", error),
      );
    };
    const colors: ThemeColors = buildAccentTheme(accentKey, mode, style);
    return {
      mode,
      accentKey,
      style,
      colors,
      styles: createStyles(colors, style),
      setMode: apply,
      setAccent: applyAccent,
      setStyle: applyStyle,
    };
  }, [accentKey, mode, style]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within a ThemeProvider");
  }
  return ctx;
}
