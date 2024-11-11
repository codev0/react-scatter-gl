/** Compute the extent [minimum, maximum] of an array of numbers. */
export function extent(data: number[]) {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item < minimum) minimum = item;
    if (item > maximum) maximum = item;
  }
  return [minimum, maximum];
}

/** Scale a value linearly within a domain and range */
export function scaleLinear(value: number, domain: number[], range: number[]) {
  const domainDifference = domain[1] - domain[0];
  const rangeDifference = range[1] - range[0];

  const percentDomain = (value - domain[0]) / domainDifference;
  return percentDomain * rangeDifference + range[0];
}

/** Given a numeric id, encodes its value into an rgb. Can be used to store id values in "color" */
export function encodeIdToRgb(i: number): { r: number; g: number; b: number } {
  const r = (i >> 16) & 0xff;
  const g = (i >> 8) & 0xff;
  const b = i & 0xff;

  return { r: r / 255, g: g / 255, b: b / 255 };
}

/** Given an rgb color, decodes the encoded numeric id value */
export function decodeIdFromRgb(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}
