import { useEffect, useRef } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useAppTheme } from "../theme";

export type AmPm = "AM" | "PM";

const ITEM_H = 46;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function Wheel<T extends number | string>({
  values,
  selected,
  onSelect,
  format,
}: {
  values: T[];
  selected: T;
  onSelect: (value: T) => void;
  format: (value: T) => string;
}) {
  const { colors } = useAppTheme();
  const listRef = useRef<FlatList<T>>(null);

  const scrollToIndex = (index: number, animated: boolean) => {
    if (index < 0 || index >= values.length) return;
    try {
      listRef.current?.scrollToOffset({
        offset: index * ITEM_H,
        animated,
      });
    } catch {
      // List not laid out yet; the effect below retries after mount.
    }
  };

  useEffect(() => {
    const timer = setTimeout(
      () => scrollToIndex(values.indexOf(selected), false),
      60,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <View style={{ position: "relative", height: ITEM_H * 3, flex: 1 }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: ITEM_H,
          left: 0,
          right: 0,
          height: ITEM_H,
          borderRadius: 10,
          backgroundColor: colors.surfaceAlt,
        }}
      />
      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(item) => String(item)}
        getItemLayout={(_, index) => ({
          length: ITEM_H,
          offset: ITEM_H * index,
          index,
        })}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.y / ITEM_H,
          );
          const value = values[Math.min(Math.max(index, 0), values.length - 1)];
          if (value !== undefined) onSelect(value);
        }}
        renderItem={({ item }) => {
          const active = item === selected;
          return (
            <Pressable
              onPress={() => {
                onSelect(item);
                scrollToIndex(values.indexOf(item), true);
              }}
              style={{
                height: ITEM_H,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: active ? 22 : 17,
                  fontWeight: active ? "700" : "400",
                  color: active ? colors.accent : colors.muted,
                }}
              >
                {format(item)}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

/** Flexible time picker: any hour + any minute + AM/PM. */
export function TimePicker({
  hour,
  minute,
  ampm,
  onChange,
}: {
  hour: number;
  minute: number;
  ampm: AmPm;
  onChange: (hour: number, minute: number, ampm: AmPm) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", columnGap: 6 }}>
      <Wheel
        values={HOURS}
        selected={hour}
        onSelect={(h) => onChange(h, minute, ampm)}
        format={(h) => String(h)}
      />
      <Text
        style={{ color: colors.muted, fontSize: 22, fontWeight: "700" }}
      >
        :
      </Text>
      <Wheel
        values={MINUTES}
        selected={minute}
        onSelect={(m) => onChange(hour, m, ampm)}
        format={(m) => String(m).padStart(2, "0")}
      />
      <View style={{ rowGap: 6, marginLeft: 4 }}>
        {(["AM", "PM"] as AmPm[]).map((ap) => {
          const active = ap === ampm;
          return (
            <Pressable
              key={ap}
              onPress={() => onChange(hour, minute, ap)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: active ? colors.accent : colors.surfaceAlt,
              }}
            >
              <Text
                style={{
                  color: active ? colors.onAccent : colors.muted,
                  fontWeight: "700",
                }}
              >
                {ap}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
