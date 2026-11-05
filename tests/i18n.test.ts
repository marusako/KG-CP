import { afterEach, describe, expect, it } from 'vitest';
import { LANGS, getLang, langFromBrowser, setLang } from '../src/i18n/lang';
import type { Lang } from '../src/i18n/lang';
import { msg } from '../src/i18n/messages';
import { pick } from '../src/i18n/localized';
import { parseRecipe } from '../src/core/combo';
import { PROFILES } from '../src/core/profiles';

const JAPANESE = /[぀-ヿ一-鿿]/;

afterEach(() => {
  setLang('ja');
});

describe('langFromBrowser (第7段階 受け入れ条件 1)', () => {
  it("'ja'・'ja-JP' は 'ja'", () => {
    expect(langFromBrowser('ja')).toBe('ja');
    expect(langFromBrowser('ja-JP')).toBe('ja');
  });

  it("'en-US'・'fr'・undefined・'' は 'en'", () => {
    expect(langFromBrowser('en-US')).toBe('en');
    expect(langFromBrowser('fr')).toBe('en');
    expect(langFromBrowser(undefined)).toBe('en');
    expect(langFromBrowser('')).toBe('en');
  });
});

describe('getLang / setLang (第7段階 受け入れ条件 2)', () => {
  it("LANGS は ['ja', 'en']", () => {
    expect([...LANGS]).toEqual(['ja', 'en']);
  });

  it("初めは 'ja'", () => {
    expect(getLang()).toBe('ja');
  });

  it("setLang('en') のあとは 'en'、'ja' に戻せる", () => {
    setLang('en');
    expect(getLang()).toBe('en');
    setLang('ja');
    expect(getLang()).toBe('ja');
  });
});

type Table = Record<string, unknown>;
const tableOf = (lang: Lang): Table => {
  setLang(lang);
  return msg() as unknown as Table;
};

/**
 * 数でない引数を取る関数の代表の引数（第9段階で追加）。ここにない関数は (3, 4, 5, 6) で呼ぶ。
 * meterRunsText は区間の配列を受け取る（空の配列なら '' を返す決まりなので、空でない配列を渡す）
 */
const SPECIAL_ARGS: Readonly<Record<string, readonly unknown[]>> = {
  meterRunsText: [[{ dir: 2, frames: 3, pressed: [] }, { dir: 6, frames: 2, pressed: ['P'] }]],
  // 第10段階: 技のフレームメーターの文（技名と技のフレーム）と、通常技の名前（姿勢とボタン）
  moveMeterText: ['X (5LP)', { input: '5LP', startup: 3, active: 3, recovery: 7 }],
  normalMoveName: ['stand', 'LP'],
};

/** 関数は代表の引数（数）で呼んで文字列にする。入れ子のオブジェクトは辿る */
function flatten(table: Table, prefix = ''): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(table)) {
    const key = prefix + k;
    if (typeof v === 'function') {
      const r = (v as (...a: unknown[]) => unknown)(...(SPECIAL_ARGS[key] ?? [3, 4, 5, 6]));
      out.push([key, typeof r === 'string' ? r : `<文字列でない: ${typeof r}>`]);
    } else if (typeof v === 'string') {
      out.push([key, v]);
    } else if (v !== null && typeof v === 'object') {
      out.push(...flatten(v as Table, `${key}.`));
    } else {
      out.push([key, `<文字列でない: ${typeof v}>`]);
    }
  }
  return out;
}

describe('文の表 (第7段階 受け入れ条件 3)', () => {
  it('ja と en のキーが同じ', () => {
    const ja = flatten(tableOf('ja')).map(([k]) => k).sort();
    const en = flatten(tableOf('en')).map(([k]) => k).sort();
    expect(ja.length).toBeGreaterThan(0);
    expect(en).toEqual(ja);
  });

  for (const lang of ['ja', 'en'] as const) {
    it(`${lang}: どの値も空でない文字列（関数は代表の引数で呼ぶ）`, () => {
      for (const [k, v] of flatten(tableOf(lang))) {
        expect(v, `${lang}.${k}`).not.toMatch(/^<文字列でない/);
        expect(v.trim(), `${lang}.${k}`).not.toBe('');
      }
    });
  }

  it('en に日本語の文字（ひらがな・カタカナ・漢字）がない', () => {
    const found = flatten(tableOf('en'))
      .filter(([, v]) => JAPANESE.test(v))
      .map(([k]) => k);
    expect(found).toEqual([]);
  });

  it('ja の表には日本語の文字がある（表が取り違えられていない）', () => {
    const withJa = flatten(tableOf('ja')).filter(([, v]) => JAPANESE.test(v));
    expect(withJa.length).toBeGreaterThan(0);
  });
});

describe('言語を切り替えると文が変わる (第7段階 受け入れ条件 4)', () => {
  const badRecipe = { id: 'a', name: '', steps: [{ input: '2LP' }] };
  const errorOf = () => {
    const r = parseRecipe(badRecipe, PROFILES.sf6);
    if (r.ok) throw new Error('エラーになるはずのレシピが読めた');
    return r.error;
  };

  it('parseRecipe のエラー文: en は日本語を含まず、ja に戻すと元と同じ', () => {
    const ja1 = errorOf();
    expect(ja1).toMatch(JAPANESE);
    setLang('en');
    const en = errorOf();
    expect(en.trim()).not.toBe('');
    expect(en).not.toMatch(JAPANESE);
    setLang('ja');
    expect(errorOf()).toBe(ja1);
  });

  it('describeDrop の early: en は日本語を含まず、ja に戻すと元と同じ（ja は今の文）', async () => {
    const { describeDrop } = await import('../src/ui/comboPanel');
    const r = parseRecipe(
      { id: 't', name: 't', steps: [{ input: '2LP' }, { input: '2LP', window: [10, 14] }] },
      PROFILES.sf6,
    );
    if (!r.ok) throw new Error(r.error);
    const early = { type: 'drop', stepIndex: 1, reason: 'early', offset: 3 } as const;
    const ja1 = describeDrop(early, r.recipe, 4);
    expect(ja1).toContain('早い（あと 3F 遅く）');
    setLang('en');
    const en = describeDrop(early, r.recipe, 4);
    expect(en.trim()).not.toBe('');
    expect(en).not.toMatch(JAPANESE);
    expect(en).toContain('3F');
    setLang('ja');
    expect(describeDrop(early, r.recipe, 4)).toBe(ja1);
  });

  it('describeHit: en は日本語を含まない（先行入力の文）', async () => {
    const { describeHit } = await import('../src/ui/comboPanel');
    const ja1 = describeHit(8, { min: 10, max: 14 });
    expect(ja1).toBe('+8F（先行 2F）');
    setLang('en');
    expect(describeHit(8, { min: 10, max: 14 })).not.toMatch(JAPANESE);
    expect(describeHit(null, null)).toBe('OK');
    setLang('ja');
    expect(describeHit(8, { min: 10, max: 14 })).toBe(ja1);
  });

  it('describeResult（src/ui/commandPanel.ts）の成立と incomplete が、en では日本語を含まず、ja に戻すと元の文', async () => {
    const { describeResult } = await import('../src/ui/commandPanel');
    const ok = { ok: true, motionFrames: 7, buttonDelay: 2 } as const;
    const inc = { ok: false, reason: 'incomplete', matchedSteps: 1, expected: [3] } as const;
    const jaOk = describeResult(ok);
    const jaInc = describeResult(inc);
    setLang('en');
    const enOk = describeResult(ok);
    const enInc = describeResult(inc);
    expect(enOk).not.toMatch(JAPANESE);
    expect(enOk).toContain('7');
    expect(enInc).not.toMatch(JAPANESE);
    expect(enInc).toContain('3');
    setLang('ja');
    expect(describeResult(ok)).toBe(jaOk);
    expect(describeResult(inc)).toBe(jaInc);
  });
});

describe('pick (第7段階 受け入れ条件 5)', () => {
  it('lang が ja で ja があれば ja', () => {
    expect(pick({ en: 'Spiral Arrow', ja: 'スパイラルアロー' }, 'ja')).toBe('スパイラルアロー');
  });

  it('lang が ja でも ja がなければ en', () => {
    expect(pick({ en: 'Kick Start My Heart' }, 'ja')).toBe('Kick Start My Heart');
  });

  it('lang が en なら、ja があっても en', () => {
    expect(pick({ en: 'Spiral Arrow', ja: 'スパイラルアロー' }, 'en')).toBe('Spiral Arrow');
    expect(pick({ en: 'Kick Start My Heart' }, 'en')).toBe('Kick Start My Heart');
  });
});

describe('第7段階 レビューの要修正', () => {
  it('日本語でも英語名で技を探せる（検索欄の例「spiral」）。英語でも日本語名で探せる', async () => {
    const { commandSearchTexts } = await import('../src/ui/commandPanel');
    const { CHARACTERS, moveToCommand } = await import('../src/core/characters');
    const { filterItems } = await import('../src/core/search');
    const cammy = CHARACTERS.find((c) => c.id === 'cammy');
    if (!cammy) throw new Error('cammy がありません');
    const commandsIn = (lang: Lang) =>
      cammy.moves.flatMap((m) => moveToCommand(m, PROFILES.sf6, lang) ?? []);
    setLang('ja');
    const ja = filterItems(commandsIn('ja'), 'spiral', commandSearchTexts);
    expect(ja.map((c) => c.id)).toEqual(['cammy-spiral-arrow']);
    setLang('en');
    const en = filterItems(commandsIn('en'), 'スパイラル', commandSearchTexts);
    expect(en.map((c) => c.id)).toEqual(['cammy-spiral-arrow']);
    // 表記でも今までどおり探せる
    expect(filterItems(commandsIn('en'), '214214', commandSearchTexts).map((c) => c.id)).toEqual(['cammy-sa2']);
  });

  it('日本語の「回転が足りません」の方向の区切りは、今までどおり「・」', async () => {
    const { describeResult } = await import('../src/ui/commandPanel');
    const r = { ok: false, reason: 'rotation-incomplete', missing: ['left', 'down'] } as const;
    expect(describeResult(r)).toBe('回転が足りません（足りない方向: 左・下）');
    setLang('en');
    expect(describeResult(r)).toBe('Rotation incomplete (missing: Left, Down)');
  });
});

describe('第7段階 レビューの提案 1・3（英語の言い回し、名前の誤り、名前が言語で変わること）', () => {
  it('describeDrop の early は、英語で「あと何 F 遅く押すか」と読める', async () => {
    const { describeDrop } = await import('../src/ui/comboPanel');
    const r = parseRecipe(
      { id: 't', name: 'T', steps: [{ input: '2LP' }, { input: '2LP', window: [10, 14] }] },
      PROFILES.sf6,
    );
    if (!r.ok) throw new Error(r.error);
    const e = { type: 'drop', stepIndex: 1, reason: 'early', offset: 7 } as const;
    setLang('en');
    expect(describeDrop(e, r.recipe)).toBe('Too early (press 3F later)');
  });

  it('describeResult の incomplete は、英語で「何手目までできたか」と読める', async () => {
    const { describeResult } = await import('../src/ui/commandPanel');
    setLang('en');
    expect(describeResult({ ok: false, reason: 'incomplete', matchedSteps: 2, expected: [6] })).toBe(
      'Incomplete (cleared step 2; next is 6)',
    );
  });

  it('技の入力の区切りは、英語では「/」、日本語では「・」', async () => {
    const { CHARACTERS, moveToCommand } = await import('../src/core/characters');
    const bridget = CHARACTERS.find((c) => c.id === 'bridget');
    const move = bridget?.moves.find((m) => m.id === 'bridget-stop-and-dash-send');
    if (!move) throw new Error('技がありません');
    expect(moveToCommand(move, PROFILES.ggst, 'en')?.name).toBe('Stop and Dash (Hit on Send) (236S/236HS)');
    expect(moveToCommand(move, PROFILES.ggst, 'ja')?.name).toBe('Stop and Dash (Hit on Send) (236S・236HS)');
  });

  it('サンプル 1 の名前: 手は 2LP なので、日本語は「小パン」、英語は「2LP x2」', async () => {
    const { SF6_SAMPLES } = await import('../src/core/samples');
    setLang('ja');
    expect(SF6_SAMPLES[0]!.name).toBe('小パン2回から波動（サンプル）');
    setLang('en');
    expect(SF6_SAMPLES[0]!.name).toBe('2LP x2 into fireball (sample)');
  });

  it('バーの注記は「input windows」と「shared default values」を使う', () => {
    setLang('en');
    expect(msg().barNoteSf6).toBe('Some input windows are based on public data (as of May 2024)');
    expect(msg().barNoteCommon).toBe('Input windows use shared default values');
  });

  it('コマンド・サンプル・ゲームの名前は、読んだときの言語で返る（コピーで値が固まっていない）', async () => {
    const { SF6_COMMANDS, SF6_MOTIONS, GG_COMMANDS } = await import('../src/core/commands');
    const { SF6_SAMPLES, GG_SAMPLES } = await import('../src/core/samples');
    const { GAMES } = await import('../src/core/games');
    const mbtl = () => GAMES.find((g) => g.id === 'mbtl')!.name;
    const names = () => [
      SF6_COMMANDS[0]!.name,
      SF6_MOTIONS[0]!.name,
      GG_COMMANDS[0]!.name,
      SF6_SAMPLES[0]!.name,
      GG_SAMPLES[0]!.name,
      mbtl(),
    ];
    setLang('en');
    for (const n of names()) expect(n).not.toMatch(JAPANESE);
    expect(mbtl()).toBe('MELTY BLOOD (coming later)');
    setLang('ja');
    expect(SF6_COMMANDS[0]!.name).toBe('波動 (236P)');
    expect(mbtl()).toBe('メルブラ（今後追加）');
  });
});

describe('第8段階 step-slow の文 (受け入れ条件 5)', () => {
  const r = {
    ok: false,
    reason: 'step-slow',
    stepIndex: 1,
    frames: 7,
    limit: 5,
    from: [2],
    to: [3],
  } as const;

  it('日本語: 「2 から 3 が遅すぎます（7F、猶予 5F）」', async () => {
    const { describeResult } = await import('../src/ui/commandPanel');
    expect(describeResult(r)).toBe('2 から 3 が遅すぎます（7F、猶予 5F）');
  });

  it('英語: 「Too slow from 2 to 3 (7F, limit 5F)」', async () => {
    const { describeResult } = await import('../src/ui/commandPanel');
    setLang('en');
    expect(describeResult(r)).toBe('Too slow from 2 to 3 (7F, limit 5F)');
  });

  it('方向が複数ある手は「/」でつなぐ', async () => {
    const { describeResult } = await import('../src/ui/commandPanel');
    const multi = { ...r, from: [1, 4, 7], to: [6] } as const;
    expect(describeResult(multi)).toBe('1/4/7 から 6 が遅すぎます（7F、猶予 5F）');
    setLang('en');
    expect(describeResult(multi)).toBe('Too slow from 1/4/7 to 6 (7F, limit 5F)');
  });
});

describe('GG のバーの注記 (第8段階 レビューの提案 3)', () => {
  it('日本語と英語の文', () => {
    setLang('ja');
    expect(msg().barNoteGg).toBe('一部の猶予は有志の資料（Dustloop）の値です');
    setLang('en');
    expect(msg().barNoteGg).toBe('Some input windows are based on community data (Dustloop)');
  });
});
