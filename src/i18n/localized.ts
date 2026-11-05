import type { Lang } from './lang';

/** 言語ごとの名前。ja はなくてもよい（ないときは en を使う） */
export interface LocalizedText {
  en: string;
  ja?: string;
}

/** lang が 'ja' で ja があれば ja、それ以外は en */
export function pick(text: LocalizedText, lang: Lang): string {
  return lang === 'ja' && text.ja !== undefined ? text.ja : text.en;
}
