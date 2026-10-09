export const round2 = (n: number): number => Math.round(n * 100) / 100;
export const clamp = (n: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, n));
export const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
export const joinOr = (xs: readonly string[]): string =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`;
