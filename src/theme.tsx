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
import {
  buildAccentTheme,
  createStyles,
  type AccentKey,
  type AppStyles,
  type ThemeColors,
} from "./styles/styles";

const THEME_KEY = "theme";
const ACCENT_KEY = "accent";

export type ThemeMode = "dark" | "light";

type ThemeValue = {
  mode: ThemeMode;
  accentKey: AccentKey;
  colors: ThemeColors;
  styles: AppStyles;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setAccent: (key: AccentKey) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(
    systemScheme === "light" ? "light" : "dark",
  );
  const [accentKey, setAccentKey] = useState<AccentKey>("blue");

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
    const colors: ThemeColors = buildAccentTheme(accentKey, mode);
    return {
      mode,
      accentKey,
      colors,
      styles: createStyles(colors),
      setMode: apply,
      toggleTheme: () => apply(mode === "dark" ? "light" : "dark"),
      setAccent: applyAccent,
    };
  }, [accentKey, mode]);

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
