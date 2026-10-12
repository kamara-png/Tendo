export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export const todayKey = () => dayKey(new Date());

export const shiftDays = (base: Date, amount: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + amount);
  return d;
};