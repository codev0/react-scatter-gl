import { Color as ThreeColor } from "three";

export interface Color {
  r: number;
  g: number;
  b: number;
  opacity: number;
}

const cache = new Map<string, Color>();

const regex =
  /^(rgba|hsla)\((\d+),\s*(\d+%?),\s*(\d+%?)(?:,\s*(\d+(?:\.\d+)?))?\)$/;

function parseOpacity(colorString: string) {
  const result = regex.exec(colorString);
  if (result) {
    const [, rgbaOrHsla, rh, gs, bl, opacity] = result;
    const colorString = `${rgbaOrHsla.replace("a", "")}(${rh},${gs},${bl})`;
    return { colorString, opacity: parseFloat(opacity) };
  }
  return { colorString, opacity: 1 };
}

export function parseColor(inputColorString: string): Color {
  if (cache.has(inputColorString)) return cache.get(inputColorString)!;
  const { colorString, opacity } = parseOpacity(inputColorString);
  const color = new ThreeColor(colorString);
  const { r, g, b } = color;
  const item = { r, g, b, opacity };
  cache.set(inputColorString, item);
  return item;
}
