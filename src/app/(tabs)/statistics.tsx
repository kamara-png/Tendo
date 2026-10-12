import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState, type ComponentProps } from "react";
import {
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { dayKey, shiftDays } from "../../lib/dates";
import { checkTime, currentStreak, longestStreak } from "../../lib/streaks";
import { readSettings } from "../../lib/settings";
import {
  loadHabits,
  loadNotes,
  loadStreaks,
} from "../../lib/storage";
import { sizes } from "../../styles/styles";
import { useAppTheme } from "../../theme";

type StatRowProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
};

function StatRow({ icon, label, value }: StatRowProps) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={styles.statRow}>
      <View style={styles.statRowIcon}>
        <Ionicons name={icon} size={16} color={colors.muted} />
      </View>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={styles.statRowValue}>{value}</Text>
    </View>
  );
}

const weekStartOffset = (date: Date, mondayStart: boolean) =>
  mondayStart ? (date.getDay() + 6) % 7 : date.getDay();

/** Normalize to local midnight so day/week windows don't depend on the clock. */
const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const countWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

type HeatmapCell = {
  key: string;
  count: number;
  future: boolean;
};

type TopNote = {
  id: string;
  title: string;
  words: number;
};

type Summary = {
  habits: number;
  notes: number;
  streaks: number;
};

type WeekBar = {
  key: string;
  label: string;
  count: number;
  isToday: boolean;
};

type TopStreak = {
  id: string;
  name: string;
  days: number;
};

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const SUNDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const RING_SIZE = 172;
const RING_STROKE = 18;

/** Lighten (positive) or darken (negative) a hex color by a ratio. */
const shade = (hex: string, amount: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const value = parseInt(h, 16);
  const channel = (shift: number) => {
    const v = (value >> shift) & 255;
    const next = Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
    return Math.max(0, Math.min(255, next));
  };
  return `#${[channel(16), channel(8), channel(0)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
};

/** Fitbit-style progress ring: thick rounded arc with a gradient sweep. */
function ProgressRing({ percent }: { percent: number }) {
  const { colors, styles } = useAppTheme();
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const dash = (clamped / 100) * circumference;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <LinearGradient id="fitbitRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={shade(colors.accent, 0.4)} />
            <Stop offset="0.5" stopColor={colors.accent} />
            <Stop offset="1" stopColor={shade(colors.accent, -0.25)} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke={colors.surfaceAlt}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke="url(#fitbitRing)"
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          width: RING_SIZE,
          height: RING_SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={styles.ringValue}>{clamped}%</Text>
        <Text style={styles.ringLabel}>completed</Text>
      </View>
    </View>
  );
}

export default function StatisticsScreen() {
  const { colors, styles } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom + sizes.tabBarHeight + 24;
  const [summary, setSummary] = useState<Summary>({
    habits: 0,
    notes: 0,
    streaks: 0,
  });
  const [habitsDone, setHabitsDone] = useState(0);
  const [habitsCompleted, setHabitsCompleted] = useState(0);
  const [notesWords, setNotesWords] = useState(0);
  const [notesChars, setNotesChars] = useState(0);
  const [checkedToday, setCheckedToday] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [longestCurrent, setLongestCurrent] = useState(0);
  const [weekBars, setWeekBars] = useState<WeekBar[]>([]);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [bestWeekday, setBestWeekday] = useState("—");
  const [topStreaks, setTopStreaks] = useState<TopStreak[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapCell[][]>([]);
  const [thisWeekCheckins, setThisWeekCheckins] = useState(0);
  const [lastWeekCheckins, setLastWeekCheckins] = useState(0);
  const [topNotes, setTopNotes] = useState<TopNote[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        try {
          const [habits, notes, streaks, settings] = await Promise.all([
            loadHabits(),
            loadNotes(),
            loadStreaks(),
            readSettings(),
          ]);

          if (!active) return;
          const mondayStart = settings.weekStartsMonday;
          const today = new Date();
          const todayKeyValue = dayKey(today);
          const letters = mondayStart ? WEEK_LETTERS : SUNDAY_LETTERS;
          const weekStart = startOfDay(
            shiftDays(today, -weekStartOffset(today, mondayStart)),
          );

          const bars: WeekBar[] = Array.from({ length: 7 }, (_, i) => {
            const d = shiftDays(weekStart, i);
            const key = dayKey(d);
            return {
              key,
              label: letters[i],
              count: streaks.reduce(
                (sum, s) => sum + (s.checks.includes(key) ? 1 : 0),
                0,
              ),
              isToday: key === todayKeyValue,
            };
          });

          const total = streaks.reduce((sum, s) => sum + s.checks.length, 0);
          const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
          const countByDay = new Map<string, number>();
          for (const s of streaks) {
            for (const c of s.checks) {
              countByDay.set(c, (countByDay.get(c) ?? 0) + 1);
              const t = checkTime(c);
              if (t !== null) weekdayCounts[new Date(t).getDay()] += 1;
            }
          }

          const words = notes.reduce((sum, n) => sum + countWords(n.body), 0);
          const chars = notes.reduce((sum, n) => sum + n.body.length, 0);

          const nextWeekStart = shiftDays(weekStart, 7);
          const lastWeekStart = shiftDays(weekStart, -7);
          const countBetween = (start: Date, end: Date) => {
            const s = start.getTime();
            const e = end.getTime();
            let sum = 0;
            for (const [key, value] of countByDay) {
              const t = checkTime(key);
              if (t !== null && t >= s && t < e) sum += value;
            }
            return sum;
          };

          const HEATMAP_WEEKS = 10;
          const gridStart = shiftDays(weekStart, -7 * (HEATMAP_WEEKS - 1));
          const nowTime = today.getTime();
          const grid: HeatmapCell[][] = Array.from(
            { length: HEATMAP_WEEKS },
            (_, w) =>
              Array.from({ length: 7 }, (_, d) => {
                const day = shiftDays(gridStart, w * 7 + d);
                const key = dayKey(day);
                return {
                  key,
                  count: countByDay.get(key) ?? 0,
                  future: day.getTime() > nowTime,
                };
              }),
          );

          setSummary({
            habits: habits.length,
            notes: notes.length,
            streaks: streaks.length,
          });
          setHabitsDone(
            habits.filter((h) => h.completedDate === todayKeyValue).length,
          );
          setHabitsCompleted(
            habits.filter((h) => h.completedDate !== null).length,
          );
          setNotesWords(words);
          setNotesChars(chars);
          setCheckedToday(
            streaks.filter((s) => s.checks.includes(todayKeyValue)).length,
          );
          setLongestCurrent(
            streaks.reduce(
              (max, s) => Math.max(max, currentStreak(s.checks)),
              0,
            ),
          );
          setBestStreak(
            streaks.reduce(
              (max, s) => Math.max(max, longestStreak(s.checks)),
              0,
            ),
          );
          setWeekBars(bars);
          setTotalCheckins(total);
          setBestWeekday(
            total === 0
              ? "—"
              : WEEKDAY_NAMES[
                  weekdayCounts.indexOf(Math.max(...weekdayCounts))
                ],
          );
          setTopStreaks(
            streaks
              .map((s) => ({
                id: s.id,
                name: s.name,
                days: longestStreak(s.checks),
              }))
              .sort((a, b) => b.days - a.days)
              .slice(0, 3),
          );
          setHeatmap(grid);
          setThisWeekCheckins(countBetween(weekStart, nextWeekStart));
          setLastWeekCheckins(countBetween(lastWeekStart, weekStart));
          setTopNotes(
            notes
              .map((n) => ({
                id: n.id,
                title: n.title.trim() || "Untitled note",
                words: countWords(n.body),
              }))
              .sort((a, b) => b.words - a.words)
              .slice(0, 5),
          );
        } catch (error) {
          console.error("Failed to load statistics", error);
        }
      };

      load();
      return () => {
        active = false;
      };
    }, []),
  );

  const total = summary.habits;
  const completed = habitsCompleted;
  // Completed todos over all todos; 0 todos → 0%, all completed → 100%.
  const completionRate =
    total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));
  const maxBar = Math.max(1, ...weekBars.map((b) => b.count));
  const weekDelta = thisWeekCheckins - lastWeekCheckins;

  const heatColor = (count: number, future: boolean) => {
    if (future) return colors.background;
    if (count <= 0) return colors.surfaceAlt;
    if (count === 1) return `${colors.accent}55`;
    if (count === 2) return `${colors.accent}88`;
    if (count === 3) return `${colors.accent}bb`;
    return colors.accent;
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>Your Stats</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.statListContent, { paddingBottom: bottomPad }]}
      >
        <View style={styles.statSummaryRow}>
          <View style={styles.statSummaryCard}>
            <Ionicons
              name="layers"
              size={18}
              color={colors.accent}
              style={styles.statSummaryIcon}
            />
            <Text style={styles.statSummaryValue}>{total}</Text>
            <Text style={styles.statSummaryLabel}>Total Items</Text>
          </View>
          <View style={styles.statSummaryCard}>
            <Ionicons
              name="today"
              size={18}
              color={colors.accent}
              style={styles.statSummaryIcon}
            />
            <Text style={styles.statSummaryValue}>{habitsDone}</Text>
            <Text style={styles.statSummaryLabel}>Checked Today</Text>
          </View>
          <View style={styles.statSummaryCard}>
            <Ionicons
              name="trophy"
              size={18}
              color={colors.accent}
              style={styles.statSummaryIcon}
            />
            <Text style={styles.statSummaryValue}>{bestStreak}</Text>
            <Text style={styles.statSummaryLabel}>Best Streak</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons
              name="checkmark-circle"
              size={sizes.icon}
              color={colors.accent}
            />
            <Text style={styles.statCardTitle}>{"To do's"}</Text>
          </View>
          <View style={styles.ringWrap}>
            <ProgressRing percent={completionRate} />
          </View>
          <Text style={styles.ringCaption}>
            {completed} of {total} completed
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="document" size={sizes.icon} color={colors.accent} />
            <Text style={styles.statCardTitle}>Notes</Text>
          </View>
          <StatRow
            icon="document-text-outline"
            label="Total notes"
            value={String(summary.notes)}
          />
          <StatRow
            icon="text-outline"
            label="Total words"
            value={String(notesWords)}
          />
          <StatRow
            icon="keypad-outline"
            label="Total characters"
            value={String(notesChars)}
          />
          <StatRow
            icon="calculator-outline"
            label="Avg words / note"
            value={
              summary.notes === 0
                ? "0"
                : String(Math.round(notesWords / summary.notes))
            }
          />
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="flame" size={sizes.icon} color={colors.accent} />
            <Text style={styles.statCardTitle}>Streaks</Text>
          </View>
          <StatRow
            icon="flame-outline"
            label="Total streaks"
            value={String(summary.streaks)}
          />
          <StatRow
            icon="today-outline"
            label="Checked in today"
            value={String(checkedToday)}
          />
          <View style={styles.statDivider} />
          <StatRow
            icon="ribbon-outline"
            label="Longest current streak"
            value={`${longestCurrent} day${longestCurrent === 1 ? "" : "s"}`}
          />
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons
              name="trending-up"
              size={sizes.icon}
              color={colors.accent}
            />
            <Text style={styles.statCardTitle}>Week over week</Text>
          </View>
          <StatRow
            icon="calendar-outline"
            label="This week"
            value={String(thisWeekCheckins)}
          />
          <StatRow
            icon="calendar-clear-outline"
            label="Last week"
            value={String(lastWeekCheckins)}
          />
          <View style={styles.statDivider} />
          <StatRow
            icon={weekDelta >= 0 ? "arrow-up-outline" : "arrow-down-outline"}
            label="Difference"
            value={`${weekDelta > 0 ? "+" : ""}${weekDelta}`}
          />
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons name="grid-outline" size={sizes.icon} color={colors.accent} />
            <Text style={styles.statCardTitle}>Check-in history</Text>
          </View>
          <View style={styles.heatmapGrid}>
            {heatmap.map((column, ci) => (
              <View key={ci} style={styles.heatmapCol}>
                {column.map((cell) => (
                  <View
                    key={cell.key}
                    style={[
                      styles.heatmapCell,
                      { backgroundColor: heatColor(cell.count, cell.future) },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
          <View style={styles.heatmapLegend}>
            <Text style={styles.heatmapLegendText}>Less</Text>
            {[0, 1, 2, 3].map((level) => (
              <View
                key={level}
                style={[
                  styles.heatmapLegendCell,
                  { backgroundColor: heatColor(level, false) },
                ]}
              />
            ))}
            <Text style={styles.heatmapLegendText}>More</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statCardHeader}>
            <Ionicons
              name="bar-chart"
              size={sizes.icon}
              color={colors.accent}
            />
            <Text style={styles.statCardTitle}>Activity this week</Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              height: 112,
              columnGap: 6,
              marginBottom: 12,
            }}
          >
            {weekBars.map((bar) => (
              <View
                key={bar.key}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "flex-end",
                  height: "100%",
                }}
              >
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 11,
                    marginBottom: 4,
                    height: 14,
                  }}
                >
                  {bar.count > 0 ? String(bar.count) : ""}
                </Text>
                <View
                  style={{
                    height: Math.max(6, (bar.count / maxBar) * 64),
                    width: "100%",
                    maxWidth: 30,
                    borderRadius: 6,
                    backgroundColor: bar.isToday
                      ? colors.accent
                      : colors.surfaceAlt,
                  }}
                />
                <Text
                  style={{
                    color: bar.isToday ? colors.accent : colors.muted,
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  {bar.label}
                </Text>
              </View>
            ))}
          </View>
          <StatRow
            icon="repeat-outline"
            label="Total check-ins"
            value={String(totalCheckins)}
          />
          <StatRow
            icon="calendar-outline"
            label="Most active day"
            value={bestWeekday}
          />
        </View>

        {topStreaks.length > 0 ? (
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Ionicons name="trophy" size={sizes.icon} color={colors.accent} />
              <Text style={styles.statCardTitle}>Top streaks</Text>
            </View>
            {topStreaks.map((streak) => (
              <StatRow
                key={streak.id}
                icon="flame-outline"
                label={streak.name}
                value={`${streak.days} day${streak.days === 1 ? "" : "s"}`}
              />
            ))}
          </View>
        ) : null}

        {topNotes.length > 0 ? (
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Ionicons
                name="document-text"
                size={sizes.icon}
                color={colors.accent}
              />
              <Text style={styles.statCardTitle}>Longest notes</Text>
            </View>
            {topNotes.map((note) => (
              <StatRow
                key={note.id}
                icon="document-text-outline"
                label={note.title}
                value={`${note.words} word${note.words === 1 ? "" : "s"}`}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
