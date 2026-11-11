import { StyleSheet } from "react-native";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  danger: string;
  palette: string[];
};

export const darkColors: ThemeColors = {
  background: "#17212b",
  surface: "#1f2c38",
  surfaceAlt: "#293844",
  border: "#2e3d4b",
  text: "#e8e6ec",
  muted: "#98a4b3",
  accent: "#70b9ee",
  onAccent: "#0f1b24",
  danger: "#fb414a",
  palette: [
    "#8fa9d9",
    "#7bbfa8",
    "#d9a15f",
    "#d98a97",
    "#a99ad9",
    "#9ac48f",
  ],
};

export const lightColors: ThemeColors = {
  background: "#f4f6f8",
  surface: "#ffffff",
  surfaceAlt: "#e8edf2",
  border: "#d6dde4",
  text: "#17212b",
  muted: "#5f6d7a",
  accent: "#2f8fd0",
  onAccent: "#ffffff",
  danger: "#d63840",
  palette: [
    "#4f6fae",
    "#2f8578",
    "#b5792f",
    "#b05563",
    "#6f5fae",
    "#4f8a3f",
  ],
};

/**
 * Material Design 3 tonal palette. Surfaces step through the MD3 tonal
 * roles (surface, surfaceContainer, surfaceContainerHighest) so cards and
 * rows read with real elevation even without shadows.
 */
export const materialDarkColors: ThemeColors = {
  background: "#141218",
  surface: "#1d1b20",
  surfaceAlt: "#26232b",
  border: "#36343b",
  text: "#e6e0e9",
  muted: "#cac4d0",
  accent: "#d0bcff",
  onAccent: "#0f1b24",
  danger: "#f2b8b5",
  palette: [
    "#8fa9d9",
    "#7bbfa8",
    "#d9a15f",
    "#d98a97",
    "#a99ad9",
    "#9ac48f",
  ],
};

export const materialLightColors: ThemeColors = {
  background: "#fdf7fe",
  surface: "#ffffff",
  surfaceAlt: "#f3edf7",
  border: "#e2dfe7",
  text: "#1d1b20",
  muted: "#49454f",
  accent: "#6750a4",
  onAccent: "#ffffff",
  danger: "#b3261e",
  palette: [
    "#4f6fae",
    "#2f8578",
    "#b5792f",
    "#b05563",
    "#6f5fae",
    "#4f8a3f",
  ],
};

export type AccentKey =
  | "blue"
  | "teal"
  | "amber"
  | "rose"
  | "purple"
  | "green";

export const ACCENTS: {
  key: AccentKey;
  label: string;
  dark: string;
  light: string;
}[] = [
  { key: "blue", label: "Blue", dark: "#70b9ee", light: "#2f8fd0" },
  { key: "teal", label: "Teal", dark: "#5bd0d6", light: "#1f9ca2" },
  { key: "amber", label: "Amber", dark: "#e8a33d", light: "#b5792f" },
  { key: "rose", label: "Rose", dark: "#e88a97", light: "#b05563" },
  { key: "purple", label: "Purple", dark: "#a99ad9", light: "#6f5fae" },
  { key: "green", label: "Green", dark: "#9ac48f", light: "#4f8a3f" },
];

type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  const value = parseInt(h, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const rgbToHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const mix = (a: Rgb, b: Rgb, ratio: number): Rgb =>
  a.map((v, i) => Math.round(v + (b[i] - v) * ratio)) as Rgb;

/** Gently tint a neutral color toward the accent. Low ratios keep it calm. */
const tint = (base: string, accent: string, ratio: number) =>
  rgbToHex(mix(hexToRgb(base), hexToRgb(accent), ratio));

/** Which visual language the app uses. */
export type ThemeStyle = "classic" | "material";

const baseFor = (style: ThemeStyle, mode: "dark" | "light"): ThemeColors => {
  if (style === "material") {
    return mode === "dark" ? materialDarkColors : materialLightColors;
  }
  return mode === "dark" ? darkColors : lightColors;
};

/**
 * Derive a full calm theme from the chosen accent: backgrounds and surfaces
 * get a soft tint toward the hue while text stays neutral for readability.
 */
export function buildAccentTheme(
  key: AccentKey,
  mode: "dark" | "light",
  style: ThemeStyle = "classic",
): ThemeColors {
  const base = baseFor(style, mode);
  const preset = ACCENTS.find((a) => a.key === key) ?? ACCENTS[0];
  const accent = mode === "dark" ? preset.dark : preset.light;
  // Material keeps its tonal surfaces cleaner, so tint them less.
  const [bgTint, surfaceTint, altTint, borderTint] =
    style === "material" ? [0.04, 0.03, 0.05, 0.08] : [0.07, 0.06, 0.07, 0.1];
  return {
    background: tint(base.background, accent, bgTint),
    surface: tint(base.surface, accent, surfaceTint),
    surfaceAlt: tint(base.surfaceAlt, accent, altTint),
    border: tint(base.border, accent, borderTint),
    text: base.text,
    muted: base.muted,
    accent,
    onAccent: mode === "dark" ? "#0f1b24" : "#ffffff",
    danger: base.danger,
    palette: base.palette,
  };
}

export const fonts = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

export function createStyles(colors: ThemeColors, style: ThemeStyle = "classic") {
  const material = style === "material";
  // Material Design 3 shapes: roomier corners and outlined (tonal) cards.
  const cardRadius = material ? 20 : 12;
  const inputRadius = material ? 16 : 10;
  const buttonRadius = material ? 28 : 10;
  const cardOutline = material
    ? {
        borderWidth: 1,
        borderColor: colors.border,
      }
    : {};

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 20,
    },
    headerSide: {
      width: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 30,
      fontWeight: "900",
    },
    sectionHeader: {
      color: colors.muted,
      fontFamily: fonts.bold,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 8,
      marginTop: 16,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      flexGrow: 1,
    },
    habitRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: cardRadius,
      marginBottom: 10,
      ...cardOutline,
    },
    habitName: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 16,
      flex: 1,
    },
    habitTextBlock: {
      flex: 1,
      marginLeft: 12,
    },
    habitTick: {
      padding: 2,
    },
    habitReminderText: {
      color: colors.muted,
      fontFamily: fonts.semibold,
      fontSize: 12,
      marginTop: 2,
    },
    editButton: {
      padding: 6,
      marginLeft: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: material ? 28 : 16,
      padding: 20,
    },
    modalTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 20,
      fontWeight: "800",
      marginBottom: 16,
      alignSelf: "center",
    },
    modalInput: {
      backgroundColor: colors.background,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 16,
      borderRadius: inputRadius,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 16,
    },
    modalInputMultiline: {
      minHeight: 160,
      maxHeight: 260,
      textAlignVertical: "top",
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
    },
    modalButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: buttonRadius,
    },
    modalButtonText: {
      fontFamily: fonts.bold,
      fontWeight: "700",
      fontSize: 15,
    },
    saveButton: {
      backgroundColor: colors.accent,
    },
    saveButtonText: {
      color: colors.onAccent,
    },
    cancelButtonText: {
      color: colors.text,
    },
    deleteButton: {
      padding: 6,
      marginLeft: 4,
    },
    toast: {
      position: "absolute",
      bottom: 100,
      left: 20,
      right: 20,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      elevation: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
    },
    toastText: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 14,
    },
    toastUndo: {
      color: colors.accent,
      fontFamily: fonts.bold,
      fontWeight: "700",
      fontSize: 14,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    stubText: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 14,
      fontWeight: "400",
      textAlign: "center",
    },
    noteListContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      flexGrow: 1,
    },
    noteCard: {
      backgroundColor: colors.surface,
      borderRadius: cardRadius,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 10,
      ...cardOutline,
    },
    noteCardTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 16,
      fontWeight: "700",
      flexShrink: 1,
    },
    noteCardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 4,
    },
    noteCardPreview: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    noteCardDate: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 11,
      marginTop: 6,
    },
    noteEditorContainer: {
      flex: 1,
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: 0,
    },
    noteEditorHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 20,
    },
    noteEditorHeaderTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 20,
      fontWeight: "800",
      flex: 1,
      marginHorizontal: 12,
      textAlign: "center",
    },
    noteEditorHeaderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 18,
    },
    noteEditorTitleInput: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 22,
      fontWeight: "800",
      padding: 0,
      marginBottom: 12,
    },
    noteEditorDivider: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      marginBottom: 16,
    },
    noteEditorBodyInput: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 16,
      lineHeight: 24,
      padding: 0,
      flex: 1,
      textAlignVertical: "top",
    },
    noteMenuOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    noteMenuSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 4,
    },
    noteMenuHandle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    noteMenuPreview: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingBottom: 16,
      marginBottom: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    noteMenuTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    noteMenuTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 16,
      fontWeight: "700",
      flexShrink: 1,
    },
    noteMenuPreviewText: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 12,
      marginTop: 3,
    },
    noteMenuAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    noteMenuActionText: {
      color: colors.text,
      fontFamily: fonts.semibold,
      fontSize: 16,
      fontWeight: "600",
    },
    noteMenuCancel: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      paddingVertical: 14,
      marginTop: 6,
    },
    noteMenuCancelText: {
      color: colors.accent,
      fontFamily: fonts.bold,
      fontSize: 15,
      fontWeight: "700",
    },
    streakCard: {
      backgroundColor: colors.surface,
      borderRadius: cardRadius,
      padding: 16,
      marginBottom: 12,
      ...cardOutline,
    },
    streakHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    streakName: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 16,
      flex: 1,
    },
    streakWeek: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    streakDay: {
      alignItems: "center",
      gap: 4,
    },
    streakDayLabel: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 11,
    },
    streakCheckin: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: buttonRadius,
      paddingVertical: 10,
    },
    streakCheckinActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    streakCheckinText: {
      color: colors.text,
      fontFamily: fonts.semibold,
      fontSize: 14,
      fontWeight: "600",
    },
    streakCheckinTextActive: {
      color: colors.onAccent,
      fontFamily: fonts.bold,
      fontWeight: "800",
    },
    statListContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    statSummaryRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 18,
    },
    statSummaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: cardRadius,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      ...cardOutline,
    },
    statSummaryIcon: {
      marginBottom: 4,
    },
    statSummaryValue: {
      color: colors.accent,
      fontFamily: fonts.bold,
      fontSize: 26,
      fontWeight: "900",
    },
    statSummaryLabel: {
      color: colors.muted,
      fontFamily: fonts.semibold,
      fontSize: 12,
      fontWeight: "600",
    },
    statCard: {
      backgroundColor: colors.surface,
      borderRadius: cardRadius,
      padding: 16,
      marginBottom: 12,
      ...cardOutline,
    },
    heatmapGrid: {
      flexDirection: "row",
      gap: 4,
      marginBottom: 12,
    },
    heatmapCol: {
      flex: 1,
      gap: 4,
    },
    heatmapCell: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 3,
    },
    heatmapLegend: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
    },
    heatmapLegendCell: {
      width: 12,
      height: 12,
      borderRadius: 3,
    },
    heatmapLegendText: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 11,
    },
    statCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    statCardTitle: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 15,
      fontWeight: "800",
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    statRowIcon: {
      width: 26,
      alignItems: "center",
    },
    statRowLabel: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 13,
      flex: 1,
    },
    statRowValue: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 14,
      fontWeight: "700",
    },
    statDivider: {
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      marginVertical: 6,
    },
    ringWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    ringValue: {
      color: colors.text,
      fontFamily: fonts.bold,
      fontSize: 36,
      fontWeight: "900",
    },
    ringLabel: {
      color: colors.muted,
      fontFamily: fonts.semibold,
      fontSize: 13,
      marginTop: 2,
    },
    ringCaption: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 13,
      textAlign: "center",
      marginTop: 14,
    },
    reminderCurrent: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 13,
      marginBottom: 12,
      textAlign: "center",
    },
    reminderRemoveButton: {
      backgroundColor: colors.danger,
      marginTop: 4,
    },
    settingsListContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    settingsSection: {
      marginBottom: 24,
    },
    settingsSectionTitle: {
      color: colors.muted,
      fontFamily: fonts.bold,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
      marginLeft: 4,
    },
    settingsCard: {
      backgroundColor: colors.surface,
      borderRadius: cardRadius,
      overflow: "hidden",
      ...cardOutline,
    },
    settingsRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
    },
    settingsRowIcon: {
      width: 26,
      alignItems: "center",
    },
    settingsRowLabel: {
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 15,
      flex: 1,
    },
    settingsRowSub: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 12,
      marginTop: 2,
    },
    settingsRowDanger: {
      color: colors.danger,
      fontFamily: fonts.bold,
      fontWeight: "700",
    },
    settingsRowDivider: {
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    accentSwatchRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 2,
    },
    accentSwatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    accentSwatchSelected: {
      borderColor: colors.text,
    },
    settingsNote: {
      textAlign: "center",
      color: colors.accent,
      fontFamily: fonts.semibold,
      fontSize: 12,
      marginTop: 12,
    },
    modalBody: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
      textAlign: "center",
    },
    dangerButton: {
      backgroundColor: colors.danger,
    },
    // Theme style selector (Classic / Material)
    themeStyleRow: {
      flexDirection: "row",
      backgroundColor: colors.background,
      borderRadius: inputRadius,
      padding: 4,
      gap: 4,
      marginHorizontal: 14,
      marginBottom: 14,
    },
    themeStyleOption: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: inputRadius - 4,
    },
    themeStyleOptionActive: {
      backgroundColor: colors.accent,
    },
    themeStyleOptionText: {
      color: colors.muted,
      fontFamily: fonts.semibold,
      fontWeight: "600",
      fontSize: 13,
    },
    themeStyleOptionTextActive: {
      color: colors.onAccent,
      fontFamily: fonts.bold,
      fontWeight: "700",
    },
    // Notes editor save pill
    editorSavePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: buttonRadius,
      backgroundColor: colors.accent,
    },
    editorSavePillSaved: {
      backgroundColor: colors.surfaceAlt,
    },
    editorSavePillText: {
      color: colors.onAccent,
      fontFamily: fonts.bold,
      fontWeight: "700",
      fontSize: 14,
    },
    editorSavePillTextSaved: {
      color: colors.accent,
    },
    // Streaks hero summary
    streakSummaryRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 16,
    },
    streakSummaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: cardRadius,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      ...cardOutline,
    },
    streakSummaryValue: {
      color: colors.accent,
      fontFamily: fonts.bold,
      fontSize: 24,
      fontWeight: "900",
    },
    streakSummaryLabel: {
      color: colors.muted,
      fontFamily: fonts.semibold,
      fontSize: 11,
      fontWeight: "600",
      textAlign: "center",
    },
    streakCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },
    streakBadge: {
      width: 44,
      height: 44,
      borderRadius: material ? 14 : 22,
      alignItems: "center",
      justifyContent: "center",
    },
    streakBadgeText: {
      color: colors.onAccent,
      fontFamily: fonts.bold,
      fontWeight: "800",
      fontSize: 17,
    },
    streakTitleBlock: {
      flex: 1,
    },
    streakTitle: {
      color: colors.text,
      fontFamily: fonts.semibold,
      fontWeight: "600",
      fontSize: 16,
    },
    streakSubtitle: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 12,
      marginTop: 2,
    },
    streakWeekBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceAlt,
      marginBottom: 12,
      overflow: "hidden",
    },
    streakWeekBarFill: {
      height: "100%",
      borderRadius: 3,
    },
    streakDayNumber: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 9,
    },
    streakDayTodayLabel: {
      color: colors.accent,
      fontFamily: fonts.bold,
      fontWeight: "700",
      fontSize: 11,
    },
    // App updates section
    updateProgressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceAlt,
      overflow: "hidden",
      marginTop: 10,
    },
    updateProgressFill: {
      height: "100%",
      backgroundColor: colors.accent,
      borderRadius: 3,
    },
    updateNotes: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 8,
    },
    updateBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: colors.accent,
    },
    updateBadgeText: {
      color: colors.onAccent,
      fontFamily: fonts.bold,
      fontWeight: "700",
      fontSize: 11,
    },
  });
}

export const sizes = {
  icon: 24,
  tabIcon: 21,
  tabBarHeight: 62,
};

export type AppStyles = ReturnType<typeof createStyles>;
