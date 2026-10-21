import { Ionicons } from "@expo/vector-icons";
import { BlurView, type BlurTint } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useMemo, type ComponentProps } from "react";
import {
  Platform,
  StyleSheet,
  type ColorValue,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, sizes } from "../../styles/styles";
import { useAppTheme } from "../../theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type TabIconSpec = {
  symbol: SFSymbol;
  symbolActive: SFSymbol;
  focused: IoniconName;
  unfocused: IoniconName;
};

const makeIcon = (spec: TabIconSpec) => {
  const { symbol, symbolActive, focused, unfocused } = spec;
  const TabIcon = ({
    focused: isFocused,
    color,
  }: {
    focused: boolean;
    color: ColorValue;
  }) => (
    <SymbolView
      name={isFocused ? symbolActive : symbol}
      tintColor={color}
      size={sizes.tabIcon + 3}
      weight={isFocused ? "semibold" : "regular"}
      fallback={
        <Ionicons
          size={sizes.tabIcon}
          name={isFocused ? focused : unfocused}
          color={color}
        />
      }
    />
  );
  TabIcon.displayName = `TabIcon(${symbol})`;
  return TabIcon;
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { mode, colors } = useAppTheme();

  const useGlass = Platform.OS === "ios" && isGlassEffectAPIAvailable();

  const floatingBarStyle = useMemo<ViewStyle>(
    () => ({
      position: "absolute",
      left: 12,
      right: 12,
      bottom: insets.bottom + 10,
      height: sizes.tabBarHeight,
      borderRadius: sizes.tabBarHeight / 2,
      borderTopWidth: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: mode === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
      backgroundColor: "transparent",
      overflow: "hidden",
      elevation: 0,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    }),
    [insets.bottom, mode],
  );

  const glassTint = useMemo<BlurTint>(
    () => (mode === "dark" ? "dark" : "light"),
    [mode],
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarBackground: () =>
          useGlass ? (
            <GlassView
              style={StyleSheet.absoluteFill}
              glassEffectStyle="regular"
              colorScheme={mode}
            />
          ) : (
            <BlurView
              tint={glassTint}
              intensity={80}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
          ),
        tabBarStyle: floatingBarStyle,
        tabBarLabelStyle: {
          fontFamily: fonts.semibold,
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          justifyContent: "center",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Todos",
          tabBarIcon: makeIcon({
            symbol: "checkmark.circle",
            symbolActive: "checkmark.circle.fill",
            focused: "checkmark-circle",
            unfocused: "checkmark-circle-outline",
          }),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: makeIcon({
            symbol: "doc.text",
            symbolActive: "doc.text.fill",
            focused: "document",
            unfocused: "document-outline",
          }),
        }}
      />
      <Tabs.Screen
        name="streaks"
        options={{
          title: "Streaks",
          tabBarIcon: makeIcon({
            symbol: "flame",
            symbolActive: "flame.fill",
            focused: "flame",
            unfocused: "flame-outline",
          }),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: "Stats",
          tabBarIcon: makeIcon({
            symbol: "chart.bar",
            symbolActive: "chart.bar.fill",
            focused: "podium",
            unfocused: "podium-outline",
          }),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: makeIcon({
            symbol: "gearshape",
            symbolActive: "gearshape.fill",
            focused: "settings",
            unfocused: "settings-outline",
          }),
        }}
      />
    </Tabs>
  );
}
