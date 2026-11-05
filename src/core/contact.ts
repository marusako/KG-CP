// 技が当たったときの知らせ。dummy.ts が作る。画面の文（i18n/messages.ts）も読むため、ほかの core を読まない別のファイルにある

/** 技が当たったときの知らせ */
export interface Contact {
  kind: 'hit' | 'block';
  knockdown: boolean;
  /** 相手の硬直が続いている間に当たった（ヒットならコンボ、ガードなら連続ガード） */
  combo: boolean;
  /** その技の有利（Reaction.advantage） */
  advantage: number;
}

/** 有利の数を符号つきにする。5 → '+5'、-2 → '-2'、0 → '±0'（帯の右端と文で使う。言語によらない） */
export function formatAdvantage(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? String(n) : '±0';
}
