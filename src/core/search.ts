/** 検索のための正規化。NFKC（全角の数字・英字を半角にする）と、小文字にすること、前後の空白を取ること */
export function normalizeQuery(text: string): string {
  return text.normalize('NFKC').toLowerCase().trim();
}

/** query を空白で区切った語が、すべて texts(item) のどれかに含まれるものを、元の順で返す。query が空なら全部 */
export function filterItems<T>(items: readonly T[], query: string, texts: (item: T) => readonly string[]): T[] {
  const words = normalizeQuery(query).split(/\s+/).filter((w) => w !== '');
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const hay = texts(item).map(normalizeQuery);
    return words.every((w) => hay.some((t) => t.includes(w)));
  });
}
