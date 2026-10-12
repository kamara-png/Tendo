import { checkTime, currentStreak, longestStreak } from "../streaks";

describe("checkTime", () => {
  it("parses a valid key to local midnight", () => {
    expect(checkTime("2026-01-05")).toBe(new Date(2026, 0, 5).getTime());
  });

  it("rejects malformed keys", () => {
    expect(checkTime("nope")).toBeNull();
    expect(checkTime("2026-01")).toBeNull();
  });
});

describe("longestStreak", () => {
  it("finds the longest consecutive run", () => {
    expect(
      longestStreak(["2026-01-01", "2026-01-02", "2026-01-03", "2026-02-01"]),
    ).toBe(3);
  });

  it("dedupes repeated days", () => {
    expect(longestStreak(["2026-01-01", "2026-01-01", "2026-01-02"])).toBe(2);
  });

  it("returns 0 with no checks", () => {
    expect(longestStreak([])).toBe(0);
  });
});

describe("currentStreak", () => {
  const from = new Date(2026, 0, 10);

  it("counts a run ending today", () => {
    expect(
      currentStreak(["2026-01-08", "2026-01-09", "2026-01-10"], from),
    ).toBe(3);
  });

  it("keeps the streak when today isn't checked yet but yesterday is", () => {
    expect(currentStreak(["2026-01-08", "2026-01-09"], from)).toBe(2);
  });

  it("returns 0 when the latest check is older than yesterday", () => {
    expect(currentStreak(["2026-01-07"], from)).toBe(0);
  });
});
