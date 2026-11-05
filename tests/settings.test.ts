import { describe, expect, it } from 'vitest';
import type { Lang } from '../src/i18n/lang';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings } from '../src/core/settings';

describe('DEFAULT_SETTINGS (受け入れ条件 4)', () => {
  it('volume 80・lastGame null・lang ja', () => {
    expect(DEFAULT_SETTINGS).toEqual({ volume: 80, lastGame: null, lastCharacter: {}, lang: 'ja', dummyMode: 'hit' });
  });
});

describe('parseSettings: 全体が読めないとき (受け入れ条件 4)', () => {
  it('null は既定値', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('壊れた JSON は例外を投げず既定値', () => {
    expect(parseSettings('{volume:')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('')).toEqual(DEFAULT_SETTINGS);
  });

  it('配列・数値・文字列・null の JSON は既定値', () => {
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"abc"')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
  });

  it('空オブジェクトは既定値', () => {
    expect(parseSettings('{}')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('parseSettings: volume (受け入れ条件 4)', () => {
  const vol = (v: string) => parseSettings(`{"volume":${v}}`).volume;

  it('150 は 100 に収める', () => {
    expect(vol('150')).toBe(100);
  });

  it('-3 は 0 に収める', () => {
    expect(vol('-3')).toBe(0);
  });

  it('42.6 は 43 に四捨五入', () => {
    expect(vol('42.6')).toBe(43);
  });

  it('範囲内の整数はそのまま', () => {
    expect(vol('0')).toBe(0);
    expect(vol('100')).toBe(100);
    expect(vol('55')).toBe(55);
  });

  it("文字列 '50' は既定値 80", () => {
    expect(vol('"50"')).toBe(80);
  });

  it('数でない値 (null・文字列・真偽値・配列) は既定値 80', () => {
    expect(vol('null')).toBe(80);
    expect(vol('"abc"')).toBe(80);
    expect(vol('true')).toBe(80);
    expect(vol('[]')).toBe(80);
  });

  it('有限でない数 (1e999 は JSON.parse で Infinity) は既定値 80', () => {
    expect(vol('1e999')).toBe(80);
    expect(vol('-1e999')).toBe(80);
  });

  it('volume がなければ 80', () => {
    expect(parseSettings('{"lastGame":"sf6"}').volume).toBe(80);
  });
});

describe('parseSettings: lastGame (受け入れ条件 4)', () => {
  const last = (v: string) => parseSettings(`{"lastGame":${v}}`).lastGame;

  it("'ggst' は 'ggst'", () => {
    expect(last('"ggst"')).toBe('ggst');
  });

  it("'sf6' は 'sf6'", () => {
    expect(last('"sf6"')).toBe('sf6');
  });

  it("選べない 'mbtl' は null", () => {
    expect(last('"mbtl"')).toBeNull();
  });

  it("知らない id 'xx' は null", () => {
    expect(last('"xx"')).toBeNull();
  });

  it('数値・真偽値・null は null', () => {
    expect(last('1')).toBeNull();
    expect(last('true')).toBeNull();
    expect(last('null')).toBeNull();
  });

  it('lastGame がなければ null', () => {
    expect(parseSettings('{"volume":30}').lastGame).toBeNull();
  });
});

describe('parseSettings: 項目ごとに見る (受け入れ条件 4)', () => {
  it('lastGame だけおかしければ volume は保存した値のまま', () => {
    expect(parseSettings('{"volume":25,"lastGame":"mbtl"}')).toEqual({
      volume: 25,
      lastGame: null,
      lastCharacter: {}, lang: 'ja', dummyMode: 'hit',
    });
  });

  it('volume だけおかしければ lastGame は保存した値のまま', () => {
    expect(parseSettings('{"volume":"abc","lastGame":"ggst"}')).toEqual({
      volume: 80,
      lastGame: 'ggst',
      lastCharacter: {}, lang: 'ja', dummyMode: 'hit',
    });
  });

  it('知らない項目があっても無視して読める', () => {
    expect(parseSettings('{"volume":10,"lastGame":"sf6","extra":1}')).toEqual({
      volume: 10,
      lastGame: 'sf6',
      lastCharacter: {}, lang: 'ja', dummyMode: 'hit',
    });
  });
});

describe('serializeSettings (受け入れ条件 4)', () => {
  it('文字列を返し、JSON として読める', () => {
    const text = serializeSettings({ volume: 60, lastGame: 'sf6', lastCharacter: {}, lang: 'ja', dummyMode: 'hit' });
    expect(typeof text).toBe('string');
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('parse して戻すと同じ (往復)', () => {
    const cases = [
      { volume: 0, lastGame: null, lastCharacter: {}, lang: 'ja', dummyMode: 'hit' },
      { volume: 100, lastGame: 'sf6', lastCharacter: {}, lang: 'ja', dummyMode: 'hit' },
      { volume: 37, lastGame: 'ggst', lastCharacter: {}, lang: 'ja', dummyMode: 'hit' },
      { volume: 50, lastGame: 'sf6', lastCharacter: { sf6: 'cammy' }, lang: 'ja', dummyMode: 'hit' },
      { volume: 50, lastGame: 'ggst', lastCharacter: { sf6: 'cammy', ggst: 'bridget' }, lang: 'ja', dummyMode: 'hit' },
      DEFAULT_SETTINGS,
    ] as const;
    for (const s of cases) {
      expect(parseSettings(serializeSettings(s))).toEqual(s);
    }
  });
});

describe('parseSettings: lastCharacter (第6段階 受け入れ条件 6)', () => {
  const lc = (v: string) => parseSettings(`{"lastCharacter":${v}}`).lastCharacter;

  it('前の版の保存 (lastCharacter なし) を読むと {}', () => {
    expect(parseSettings('{"volume":50,"lastGame":"sf6"}')).toEqual({
      volume: 50,
      lastGame: 'sf6',
      lastCharacter: {}, lang: 'ja', dummyMode: 'hit',
    });
  });

  it('正しい id はそのまま残る', () => {
    expect(lc('{"sf6":"cammy","ggst":"bridget"}')).toEqual({ sf6: 'cammy', ggst: 'bridget' });
  });

  it('知らないキャラの id は捨てる', () => {
    expect(lc('{"sf6":"nobody"}')).toEqual({});
  });

  it('違うゲームのキャラの id は捨てる', () => {
    expect(lc('{"sf6":"bridget","ggst":"cammy"}')).toEqual({});
  });

  it('文字列でない値は捨てる', () => {
    expect(lc('{"sf6":1,"ggst":null}')).toEqual({});
    expect(lc('{"sf6":["cammy"]}')).toEqual({});
    expect(lc('{"sf6":true}')).toEqual({});
  });

  it('一部だけおかしければ、残りは残る', () => {
    expect(lc('{"sf6":"cammy","ggst":"cammy"}')).toEqual({ sf6: 'cammy' });
  });

  it('知らないゲームのキーは捨てる', () => {
    expect(lc('{"mbtl":"cammy"}')).toEqual({});
  });

  it('オブジェクトでない lastCharacter は {}', () => {
    expect(lc('"cammy"')).toEqual({});
    expect(lc('[1]')).toEqual({});
    expect(lc('null')).toEqual({});
  });

  it('lastCharacter がおかしくても、volume・lastGame は保存した値のまま', () => {
    expect(parseSettings('{"volume":25,"lastGame":"ggst","lastCharacter":"x"}')).toEqual({
      volume: 25,
      lastGame: 'ggst',
      lastCharacter: {}, lang: 'ja', dummyMode: 'hit',
    });
  });

  it('serializeSettings は lastCharacter も書く', () => {
    const text = serializeSettings({ volume: 60, lastGame: 'sf6', lastCharacter: { sf6: 'cammy' }, lang: 'ja', dummyMode: 'hit' });
    expect(JSON.parse(text).lastCharacter).toEqual({ sf6: 'cammy' });
  });
});

describe('parseSettings: lang (第7段階 受け入れ条件 8)', () => {
  const lang = (v: string, fallback?: Lang) => parseSettings(`{"lang":${v}}`, fallback).lang;

  it("'en' は 'en'、'ja' は 'ja'", () => {
    expect(lang('"en"')).toBe('en');
    expect(lang('"ja"', 'en')).toBe('ja');
  });

  it("lang がなければ fallbackLang（省略すると 'ja'）。前の版の保存も読める", () => {
    expect(parseSettings('{"volume":50,"lastGame":"sf6"}').lang).toBe('ja');
    expect(parseSettings('{"volume":50,"lastGame":"sf6"}', 'en').lang).toBe('en');
    expect(parseSettings('{}', 'en').lang).toBe('en');
  });

  it("'fr'・数値・null・真偽値・配列は fallbackLang", () => {
    for (const v of ['"fr"', '1', 'null', 'true', '[]', '"EN"']) {
      expect(lang(v), v).toBe('ja');
      expect(lang(v, 'en'), v).toBe('en');
    }
  });

  it('保存がない・壊れているときも fallbackLang', () => {
    expect(parseSettings(null, 'en').lang).toBe('en');
    expect(parseSettings('{lang:', 'en').lang).toBe('en');
    expect(parseSettings('[1]', 'en').lang).toBe('en');
  });

  it('lang だけおかしくても、ほかの項目は保存した値のまま', () => {
    expect(parseSettings('{"volume":25,"lastGame":"ggst","lang":"fr"}', 'en')).toEqual({
      volume: 25,
      lastGame: 'ggst',
      lastCharacter: {},
      lang: 'en', dummyMode: 'hit',
    });
  });

  it('serializeSettings は lang も書き、往復で元に戻る（fallback と違う言語でも）', () => {
    const s = { volume: 60, lastGame: 'sf6', lastCharacter: {}, lang: 'en', dummyMode: 'hit' } as const;
    expect(JSON.parse(serializeSettings(s)).lang).toBe('en');
    expect(parseSettings(serializeSettings(s), 'ja')).toEqual(s);
    const j = { ...s, lang: 'ja', dummyMode: 'hit' } as const;
    expect(parseSettings(serializeSettings(j), 'en')).toEqual(j);
  });
});

describe('parseSettings: dummyMode (第13段階 受け入れ条件 7)', () => {
  const mode = (v: string) => parseSettings(`{"dummyMode":${v}}`).dummyMode;

  it("既定は 'hit'", () => {
    expect(DEFAULT_SETTINGS.dummyMode).toBe('hit');
    expect(parseSettings(null).dummyMode).toBe('hit');
    expect(parseSettings('{}').dummyMode).toBe('hit');
  });

  it("'hit'・'block' は、そのまま読める", () => {
    expect(mode('"hit"')).toBe('hit');
    expect(mode('"block"')).toBe('block');
  });

  it("読めない値（知らない文字列・数値・真偽値・null・配列・大文字）は 'hit'", () => {
    for (const v of ['"down"', '"Block"', '"BLOCK"', '""', '1', 'true', 'null', '[]', '{}', '["block"]']) {
      expect(mode(v), v).toBe('hit');
    }
  });

  it('前の版の保存（dummyMode なし）を読むと、ほかの項目はそのまま、dummyMode は hit', () => {
    expect(parseSettings('{"volume":25,"lastGame":"ggst","lang":"en"}')).toEqual({
      volume: 25,
      lastGame: 'ggst',
      lastCharacter: {},
      lang: 'en',
      dummyMode: 'hit',
    });
  });

  it('dummyMode だけおかしくても、ほかの項目は保存した値のまま', () => {
    expect(parseSettings('{"volume":25,"lastGame":"ggst","dummyMode":"x"}')).toEqual({
      volume: 25,
      lastGame: 'ggst',
      lastCharacter: {},
      lang: 'ja',
      dummyMode: 'hit',
    });
  });

  it('壊れた保存でも dummyMode は hit', () => {
    expect(parseSettings('{dummyMode:').dummyMode).toBe('hit');
    expect(parseSettings('[1]').dummyMode).toBe('hit');
  });

  it('serializeSettings は dummyMode も書き、往復で元に戻る', () => {
    const s = { volume: 60, lastGame: 'sf6', lastCharacter: {}, lang: 'ja', dummyMode: 'block' } as const;
    expect(JSON.parse(serializeSettings(s)).dummyMode).toBe('block');
    expect(parseSettings(serializeSettings(s))).toEqual(s);
    const h = { ...s, dummyMode: 'hit' } as const;
    expect(parseSettings(serializeSettings(h))).toEqual(h);
  });

  it('dummyMode だけ違う設定は、往復しても混ざらない', () => {
    const b = { ...DEFAULT_SETTINGS, dummyMode: 'block' } as const;
    expect(parseSettings(serializeSettings(b)).dummyMode).toBe('block');
    expect(parseSettings(serializeSettings(DEFAULT_SETTINGS)).dummyMode).toBe('hit');
  });
});
