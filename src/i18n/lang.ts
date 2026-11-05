export type Lang = 'ja' | 'en';
export const LANGS: readonly Lang[] = ['ja', 'en'];

/** 言語の選択肢に出す名前。どの言語で表示していても、その言語の名前で出す */
export const LANG_NAMES: Readonly<Record<Lang, string>> = { ja: '日本語', en: 'English' };

/** ブラウザの言語（navigator.language）から初めの言語を決める。'ja' で始まれば 'ja'、それ以外は 'en' */
export function langFromBrowser(navigatorLanguage: string | undefined): Lang {
  return /^ja(-|$)/i.test(navigatorLanguage ?? '') ? 'ja' : 'en';
}

let current: Lang = 'ja';

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
}
