/** Cycles through the palette so adjacent list items never share a color. */
export function colorForIndex(index: number, palette: string[]): string {
  if (palette.length === 0) return "";
  return palette[index % palette.length];
}
