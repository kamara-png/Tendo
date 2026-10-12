import { dayKey, shiftDays, todayKey } from "../dates";

describe("dayKey", () => {
  it("zero-pads month and day", () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dayKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("shiftDays", () => {
  it("does not mutate the input date", () => {
    const base = new Date(2026, 0, 31);
    const next = shiftDays(base, 1);
    expect(dayKey(next)).toBe("2026-02-01");
    expect(dayKey(base)).toBe("2026-01-31");
  });

  it("crosses month and year boundaries", () => {
    expect(dayKey(shiftDays(new Date(2025, 11, 31), 1))).toBe("2026-01-01");
    expect(dayKey(shiftDays(new Date(2026, 2, 1), -1))).toBe("2026-02-28");
  });
});

describe("todayKey", () => {
  it("matches dayKey for the current date", () => {
    expect(todayKey()).toBe(dayKey(new Date()));
  });
});
