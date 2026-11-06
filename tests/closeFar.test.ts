// 第20段階 受け入れ条件 1〜5: ブリジットの近S（c.S）・遠S（f.S）と距離。
// 距離は selectMove・stepFighter の最後の省略できる引数（'close' | 'far'。渡さなければ 'close'）で渡す。
import { describe, expect, it } from 'vitest';
import { CHARACTERS, comboToRecipe } from '../src/core/characters';
import type { CharacterData } from '../src/core/characters';
import { parseRecipe } from '../src/core/combo';
import type { ComboRecipe } from '../src/core/combo';
import { initialSimTrial, resolveRecipe, stepSimTrial } from '../src/core/comboSim';
import type { SimFrame, SimTrialEvent } from '../src/core/comboSim';
import { GG_RULES, SF6_RULES } from '../src/core/commands';
import { INITIAL_DUMMY, stepDummy } from '../src/core/dummy';
import type { DummyState } from '../src/core/dummy';
import { INITIAL_FIGHTER, moveDisplayName, selectMove, stepFighter } from '../src/core/fighter';
import type { FighterState } from '../src/core/fighter';
import { fighterDataFor } from '../src/core/frameData';
import type { MoveFrames } from '../src/core/frameData';
import { parseStep } from '../src/core/notation';
import type { NotationRules } from '../src/core/notation';
import { PROFILES } from '../src/core/profiles';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings } from '../src/core/settings';
import type { Direction, FrameInput } from '../src/core/types';

const bridget = { data: fighterDataFor('bridget')!, character: CHARACTERS.find((c) => c.id === 'bridget')! };
const cammy = { data: fighterDataFor('cammy')!, character: CHARACTERS.find((c) => c.id === 'cammy')! };
const N: FrameInput = { dir: 5, buttons: [] };
const b = (dir: Direction, ...buttons: string[]): FrameInput => ({ dir, buttons });
type Entries = [number, FrameInput][];
const c236 = (f: number, btn: string): Entries => [[f - 2, b(2)], [f - 1, b(3)], [f, b(6, btn)]];
const moveOf = (input: string): MoveFrames => {
  const m = bridget.data.moves.find((x) => x.input === input);
  if (!m) throw new Error(`ブリジットに ${input} がありません`);
  return m;
};

// ---------------------------------------------------------------- 条件 1: データ

describe('c.S・f.S のデータ (第20段階 受け入れ条件 1)', () => {
  const BRIDGET_SPECIAL = ['236K', '236S', '236HS', '623P', '63214P'];
  const BRIDGET_SA = ['632146S'];

  it('5S はなく、c.S と f.S がある', () => {
    const inputs = bridget.data.moves.map((m) => m.input);
    expect(inputs).not.toContain('5S');
    expect(inputs).toContain('c.S');
    expect(inputs).toContain('f.S');
  });

  it('c.S は今の 5S の値: 発生前 6・持続 6・硬直 13、ヒット +13、ガード +1、ヒットストップ 14', () => {
    const m = moveOf('c.S');
    expect([m.startup, m.active, m.recovery, m.onHit, m.onBlock, m.hitstop]).toEqual([6, 6, 13, 13, 1, 14]);
  });

  it('f.S: 発生前 9・持続 5・硬直 18、ヒット -6、ガード -9、ヒットストップ 13', () => {
    const m = moveOf('f.S');
    expect([m.startup, m.active, m.recovery, m.onHit, m.onBlock, m.hitstop]).toEqual([9, 5, 18, -6, -9, 13]);
  });

  it('c.S のキャンセル先に f.S がある（ほかは今までどおり）', () => {
    const c = [...(moveOf('c.S').cancels ?? [])].sort();
    expect(c).toEqual(['f.S', '2S', '5HS', '2HS', '5D', '2D', ...BRIDGET_SPECIAL, ...BRIDGET_SA].sort());
  });

  it('f.S のキャンセル先は 5HS・2HS・必殺技・SA', () => {
    const c = [...(moveOf('f.S').cancels ?? [])].sort();
    expect(c).toEqual(['5HS', '2HS', ...BRIDGET_SPECIAL, ...BRIDGET_SA].sort());
  });

  it('どの技の cancels にも 5S は残っていない', () => {
    for (const m of bridget.data.moves) expect(m.cancels ?? [], m.input).not.toContain('5S');
  });
});

// ---------------------------------------------------------------- 条件 2: 表記

describe('c.S・f.S の表記 (第20段階 受け入れ条件 2)', () => {
  it('c.S は range close、f.S は range far の normal（方向は 5）', () => {
    const c = parseStep('c.S', PROFILES.ggst);
    const f = parseStep('f.S', PROFILES.ggst);
    if (!c.ok || !f.ok) throw new Error('読めませんでした');
    expect(c.input).toEqual({ kind: 'normal', dirs: [5], buttons: ['S'], range: 'close' });
    expect(f.input).toEqual({ kind: 'normal', dirs: [5], buttons: ['S'], range: 'far' });
  });

  it('5S は今までどおり読め、range なし', () => {
    const r = parseStep('5S', PROFILES.ggst);
    if (!r.ok) throw new Error('読めませんでした');
    expect(r.input).toEqual({ kind: 'normal', dirs: [5], buttons: ['S'] });
    expect('range' in r.input).toBe(false);
  });

  it('SF6 の c.LP・f.LP は失敗（エラー文は空でない）。GG でも S 以外（c.P・f.K）は失敗', () => {
    for (const [text, rules] of [
      ['c.LP', PROFILES.sf6],
      ['f.LP', PROFILES.sf6],
      ['c.P', PROFILES.ggst],
      ['f.K', PROFILES.ggst],
    ] as const) {
      const r = parseStep(text, rules);
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.error.trim(), text).not.toBe('');
    }
  });
});

// ---------------------------------------------------------------- 条件 3: 距離

describe('距離で S を出し分ける (第20段階 受け入れ条件 3)', () => {
  const sel = (h: FrameInput[], distance?: 'close' | 'far') =>
    (distance === undefined
      ? selectMove(h, bridget.data, bridget.character, GG_RULES)
      : selectMove(h, bridget.data, bridget.character, GG_RULES, distance)
    )?.input ?? null;

  it('5 + S: 近いなら c.S、遠いなら f.S。距離を渡さなければ c.S', () => {
    expect(sel([b(5, 'S')], 'close')).toBe('c.S');
    expect(sel([b(5, 'S')], 'far')).toBe('f.S');
    expect(sel([b(5, 'S')])).toBe('c.S');
  });

  it('4 + S・6 + S も立ちの S（距離で出し分ける）', () => {
    for (const dir of [4, 6] as const) {
      expect(sel([b(dir, 'S')], 'close'), `dir=${dir}`).toBe('c.S');
      expect(sel([b(dir, 'S')], 'far'), `dir=${dir}`).toBe('f.S');
    }
  });

  it('2 + S は距離によらず 2S（斜め下 1・3 も同じ）', () => {
    for (const dir of [1, 2, 3] as const) {
      for (const d of ['close', 'far'] as const) expect(sel([b(dir, 'S')], d), `dir=${dir} ${d}`).toBe('2S');
    }
  });

  it('距離は S 以外に効かない: 5P・5K・5HS・2HS は遠くても同じ', () => {
    expect(sel([b(5, 'P')], 'far')).toBe('5P');
    expect(sel([b(5, 'K')], 'far')).toBe('5K');
    expect(sel([b(5, 'HS')], 'far')).toBe('5HS');
    expect(sel([b(2, 'HS')], 'far')).toBe('2HS');
  });

  it('stepFighter も距離を受け取り、遠いなら f.S（発生前 9）、近いなら c.S（発生前 6）が始まる', () => {
    const run = (distance: 'close' | 'far') => {
      let f: FighterState = INITIAL_FIGHTER;
      const h: FrameInput[] = [N, N, b(5, 'S')];
      return stepFighter(f, h, bridget, PROFILES.ggst, 4, distance) ?? f;
    };
    const far = run('far');
    expect([far.move?.input, far.phase, far.frame]).toEqual(['f.S', 'startup', 0]);
    const close = run('close');
    expect([close.move?.input, close.phase, close.frame]).toEqual(['c.S', 'startup', 0]);
  });

  it('キャミィは今までどおり（距離に関わらず 5LP・5HP）', () => {
    for (const d of ['close', 'far'] as const) {
      expect(selectMove([b(5, 'LP')], cammy.data, cammy.character, SF6_RULES, d)?.input).toBe('5LP');
      expect(selectMove([b(5, 'HP')], cammy.data, cammy.character, SF6_RULES, d)?.input).toBe('5HP');
    }
  });

  it('技の名前: c.S は 近S (c.S) / Close S (c.S)、f.S は 遠S (f.S) / Far S (f.S)', () => {
    const name = (input: string, lang: 'ja' | 'en') => moveDisplayName(moveOf(input), bridget.character, GG_RULES, lang);
    expect(name('c.S', 'ja')).toBe('近S (c.S)');
    expect(name('c.S', 'en')).toBe('Close S (c.S)');
    expect(name('f.S', 'ja')).toBe('遠S (f.S)');
    expect(name('f.S', 'en')).toBe('Far S (f.S)');
  });
});

// ---------------------------------------------------------------- 条件 4: 設定

describe('設定の distance (第20段階 受け入れ条件 4)', () => {
  it('既定は close', () => {
    expect(DEFAULT_SETTINGS.distance).toBe('close');
    expect(parseSettings(null).distance).toBe('close');
    expect(parseSettings('{}').distance).toBe('close');
  });

  it("'far'・'close' は読める。読めない値（'mid'・数・null・真偽）は 'close'", () => {
    expect(parseSettings('{"distance":"far"}').distance).toBe('far');
    expect(parseSettings('{"distance":"close"}').distance).toBe('close');
    for (const v of ['"mid"', '3', 'null', 'true', '[]']) expect(parseSettings(`{"distance":${v}}`).distance, v).toBe('close');
  });

  it('保存して読み戻すと同じ（far も）', () => {
    const s = { ...DEFAULT_SETTINGS, distance: 'far' as const };
    expect(parseSettings(serializeSettings(s)).distance).toBe('far');
  });
});

// ---------------------------------------------------------------- 条件 5: コンボ

describe('ブリジットのコンボ 1〜5 (第20段階 受け入れ条件 5)', () => {
  const ch = bridget.character as CharacterData;
  const IDS = ['bridget-combo-1', 'bridget-combo-2', 'bridget-combo-3', 'bridget-combo-4', 'bridget-combo-5'];
  const EXPECTED: Record<string, string[][]> = {
    'bridget-combo-1': [['c.S'], ['2S'], ['2HS'], ['236K']],
    'bridget-combo-2': [['c.S'], ['2S'], ['5HS'], ['236K']],
    'bridget-combo-3': [['c.S'], ['f.S'], ['5HS'], ['236K']],
    'bridget-combo-4': [['c.S'], ['f.S'], ['2HS'], ['236K']],
    'bridget-combo-5': [['c.S'], ['2S'], ['2HS'], ['236K~K']],
  };

  it('5 つがキャラのコンボにあり、新しい判定で決まる（resolveRecipe が null でなく、手の技が表のとおり）', () => {
    expect(ch.combos.map((c) => c.id)).toEqual(IDS);
    for (const combo of ch.combos) {
      const recipe = comboToRecipe(combo, PROFILES.ggst);
      expect(recipe, combo.id).not.toBeNull();
      const moves = resolveRecipe(recipe!, bridget.data, GG_RULES);
      expect(moves, combo.id).not.toBeNull();
      expect(moves!.map((l) => l.map((m) => m.input)), combo.id).toEqual(EXPECTED[combo.id]);
    }
  });

  it('手が 5S（range なし）なら、c.S と f.S のどちらにも当たる', () => {
    const r = parseRecipe(
      { id: 'r', name: 'r', steps: [{ input: '5S' }, { input: '2S', window: [0, 15] }] },
      GG_RULES as NotationRules,
    );
    if (!r.ok) throw new Error(r.error);
    const moves = resolveRecipe(r.recipe, bridget.data, GG_RULES);
    expect(moves?.[0]?.map((m) => m.input).sort()).toEqual(['c.S', 'f.S']);
  });

  it('combo-3（c.S > f.S > 5HS > 236K）を、距離を手に合わせて渡して押すと完走する。当たるのは 6・30・54・78', () => {
    const recipe: ComboRecipe = comboToRecipe(ch.combos.find((c) => c.id === 'bridget-combo-3')!, PROFILES.ggst)!;
    const moves = resolveRecipe(recipe, bridget.data, GG_RULES)!;
    const ORIGIN = 20;
    const length = 130;
    const entries: Entries = [[0, b(5, 'S')], [10, b(5, 'S')], [35, b(5, 'HS')], ...c236(60, 'K')];
    const inputs: FrameInput[] = Array.from({ length: ORIGIN + length }, () => N);
    for (const [f, input] of entries) inputs[ORIGIN + f] = input;

    let fighter: FighterState = INITIAL_FIGHTER;
    let dummy: DummyState = INITIAL_DUMMY;
    let state = initialSimTrial();
    let distance: 'close' | 'far' = 'close'; // 1 手目の前は、最初の c.S・f.S の手（c.S）に合わせる
    const history: FrameInput[] = [];
    const events: [number, SimTrialEvent][] = [];
    const contacts: number[] = [];
    const started: [number, string][] = [];
    inputs.forEach((input, i) => {
      history.push(input);
      const stepped = stepFighter(fighter, history, bridget, PROFILES.ggst, 4, distance);
      const r = stepDummy(dummy, stepped, 'hit');
      const sim: SimFrame = { frame: i, before: fighter, after: r.fighter, dummyBefore: dummy, dummyAfter: r.dummy, contact: r.contact };
      const out = stepSimTrial(state, moves, sim, 4);
      state = out.state;
      if (out.event) events.push([i - ORIGIN, out.event]);
      if (r.contact) contacts.push(i - ORIGIN);
      if (r.fighter.move && r.fighter.phase === 'startup' && r.fighter.frame === 0) started.push([i - ORIGIN, r.fighter.move.input]);
      // 次に当てる手が c.S なら近い、f.S なら遠い、それ以外は前の値のまま（コンボのタブの自動の距離）
      const next = recipe.steps[state.stepIndex]?.text;
      if (next === 'c.S') distance = 'close';
      else if (next === 'f.S') distance = 'far';
      fighter = r.fighter;
      dummy = r.dummy;
    });
    // 4 つの技がこの順に始まる: c.S は 0、f.S は 21（c.S のヒットストップが明けた次）、5HS は 44、236K は 69
    expect(started).toEqual([[0, 'c.S'], [21, 'f.S'], [44, '5HS'], [69, '236K']]);
    expect(contacts).toEqual([6, 30, 54, 78]);
    expect(events.map(([f, e]) => [f, e.type, e.stepIndex])).toEqual([
      [6, 'hit', 0],
      [30, 'hit', 1],
      [54, 'hit', 2],
      [78, 'complete', 3],
    ]);
  });
});
