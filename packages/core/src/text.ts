// Text normalisation, tokenisation and a port of pg_trgm similarity.
// The same normalisation is applied to the query and to every catalogue string.

const STOPWORDS = new Set(
  (
    "a an the to of for with and or in on at by from into onto that this those these it its is are was " +
    "be been i me my we our you your do does did dont don t s can could would will need needs want " +
    "looking look find get buy know called call name thing things stuff what whats which where how " +
    "lets let use uses used using some any there so just up out as about please something anything " +
    "kind sort type thingy"
  ).split(" "),
);

// Keys are stemmed forms. Kept deliberately small and generic; not tuned to the demo products.
const SYNONYMS: Record<string, string> = {
  little: "small",
  tiny: "small",
  television: "tv",
  tvs: "tv",
  adaptor: "adapter",
  converter: "adapter",
  notebook: "laptop",
  cellphone: "phone",
  smartphone: "phone",
  mobile: "phone",
  cord: "cable",
  lead: "cable",
  faucet: "tap",
  spanner: "wrench",
  adhesive: "glue",
  tyre: "tire",
  iphone: "phone",
  android: "phone",
};

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019`]/g, "'")
    .replace(/\b(usb|type)[\s-]*([ac])\b/g, "$1$2") // usb-c / usb c / type-c -> usbc / typec
    .replace(/\bwi[\s-]?fi\b/g, "wifi")
    .replace(/(\d)\.(\d)/g, "$1$2") // 3.5mm -> 35mm
    .replace(/'s\b/g, "s") // plumber's -> plumbers
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem)
    .map((w) => SYNONYMS[w] ?? w);
}

/** pg_trgm-style trigram set: each word padded with two leading spaces and one trailing space. */
export function trigrams(text: string): Set<string> {
  const set = new Set<string>();
  for (const word of normalize(text).split(" ").filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  }
  return set;
}

export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/** Index of `needle` as a contiguous run inside `haystack`, or -1. */
export function indexOfSequence(haystack: readonly string[], needle: readonly string[]): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}
