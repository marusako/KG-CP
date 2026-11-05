import { describe, expect, it } from 'vitest';
import { GG_COMMANDS, SF6_COMMANDS, SF6_MOTIONS, SF6_RULES } from '../src/core/commands';
import { parseStep } from '../src/core/notation';
import { analyzeAttempt } from '../src/core/detect';
import type { CommandDef, Direction, FrameInput } from '../src/core/types';

const byId = (list: readonly CommandDef[], id: string) => {
  const c = list.find((d) => d.id === id);
  if (!c) throw new Error(`${id} がありません`);
  return c;
};

const dirsOf = (c: CommandDef) => (c.kind === 'motion' ? c.steps.map((s) => [...s.dirs]) : []);
const notationOf = (c: CommandDef) => (c as CommandDef & { notation: string }).notation;

describe('SF6_COMMANDS (受け入れ条件 2)', () => {
  it('今の 8 個と同じ id が、同じ順で並ぶ', () => {
    expect(SF6_COMMANDS.map((c) => c.id)).toEqual([
      '236P', '214P', '623P', '41236P', '63214P', '[4]6P', '[2]8K', '360P',
    ]);
  });

  it('360P は rotation、他は motion', () => {
    expect(byId(SF6_COMMANDS, '360P').kind).toBe('rotation');
    for (const c of SF6_COMMANDS) if (c.id !== '360P') expect(c.kind).toBe('motion');
  });

  it('notation が決まりどおり', () => {
    const expected: Record<string, string> = {
      '236P': '236', '214P': '214', '623P': '623', '41236P': '41236', '63214P': '63214',
      '[4]6P': '[4]6', '[2]8K': '[2]8', '360P': '360',
    };
    for (const [id, n] of Object.entries(expected)) expect(notationOf(byId(SF6_COMMANDS, id))).toBe(n);
  });

  it('方向・ボタン・猶予・溜めが今のまま', () => {
    const P = ['LP', 'MP', 'HP'];
    const K = ['LK', 'MK', 'HK'];
    expect(dirsOf(byId(SF6_COMMANDS, '236P'))).toEqual([[2], [3], [6]]);
    expect(dirsOf(byId(SF6_COMMANDS, '214P'))).toEqual([[2], [1], [4]]);
    expect(dirsOf(byId(SF6_COMMANDS, '623P'))).toEqual([[6], [2], [3]]);
    expect(dirsOf(byId(SF6_COMMANDS, '41236P'))).toEqual([[4], [1], [2], [3], [6]]);
    expect(dirsOf(byId(SF6_COMMANDS, '63214P'))).toEqual([[6], [3], [2], [1], [4]]);
    expect(dirsOf(byId(SF6_COMMANDS, '[4]6P'))).toEqual([[1, 4, 7], [6]]);
    expect(dirsOf(byId(SF6_COMMANDS, '[2]8K'))).toEqual([[1, 2, 3], [7, 8, 9]]);
    for (const c of SF6_COMMANDS) {
      expect([...c.buttons]).toEqual(c.id === '[2]8K' ? K : P);
    }
    const w = (id: string) => byId(SF6_COMMANDS, id);
    // ボタン猶予はスト6 公開資料の値（第5段階③）。236・214・41236・63214 は 8、623・溜め技は 6
    expect(w('236P')).toMatchObject({ motionWindow: 15, buttonWindow: 8 });
    expect(w('214P')).toMatchObject({ motionWindow: 15, buttonWindow: 8 });
    expect(w('623P')).toMatchObject({ motionWindow: 15, buttonWindow: 6 });
    expect(w('41236P')).toMatchObject({ motionWindow: 25, buttonWindow: 8 });
    expect(w('63214P')).toMatchObject({ motionWindow: 25, buttonWindow: 8 });
    expect(w('[4]6P')).toMatchObject({ motionWindow: 15, buttonWindow: 6 });
    expect(w('[2]8K')).toMatchObject({ motionWindow: 15, buttonWindow: 6 });
    expect(w('360P')).toMatchObject({ motionWindow: 40 });
    const c46 = w('[4]6P');
    const c28 = w('[2]8K');
    if (c46.kind === 'motion') expect(c46.steps[0]!.minHold).toBe(40);
    if (c28.kind === 'motion') expect(c28.steps[0]!.minHold).toBe(40);
  });

  it('名前は今のまま', () => {
    expect(byId(SF6_COMMANDS, '236P').name).toBe('波動 (236P)');
    expect(byId(SF6_COMMANDS, '360P').name).toBe('1回転 (360P)');
  });
});

describe('GG_COMMANDS (受け入れ条件 2)', () => {
  const GG_BUTTONS = ['P', 'K', 'S', 'HS', 'D'];
  const table: [string, string, string, number[][]][] = [
    ['gg-236', '236', '236 + ボタン', [[2], [3], [6]]],
    ['gg-214', '214', '214 + ボタン', [[2], [1], [4]]],
    ['gg-623', '623', '623 + ボタン', [[6], [2], [3]]],
    ['gg-41236', '41236', '41236 + ボタン', [[4], [1], [2], [3], [6]]],
    ['gg-63214', '63214', '63214 + ボタン', [[6], [3], [2], [1], [4]]],
    ['gg-632146', '632146', '632146 + ボタン', [[6], [3], [2], [1], [4], [6]]],
    ['gg-236236', '236236', '236236 + ボタン', [[2], [3], [6], [2], [3], [6]]],
    ['gg-214214', '214214', '214214 + ボタン', [[2], [1], [4], [2], [1], [4]]],
    ['gg-[4]6', '[4]6', '溜め [4]6 + ボタン', [[1, 4, 7], [6]]],
  ];

  it('10 個、id が表のとおりの順で並ぶ', () => {
    expect(GG_COMMANDS.map((c) => c.id)).toEqual([...table.map((t) => t[0]), 'gg-360']);
  });

  for (const [id, notation, name, dirs] of table) {
    it(`${id}: notation・名前・中身・ボタン`, () => {
      const c = byId(GG_COMMANDS, id);
      expect(c.kind).toBe('motion');
      expect(notationOf(c)).toBe(notation);
      expect(c.name).toBe(name);
      expect(dirsOf(c)).toEqual(dirs);
      expect([...c.buttons]).toEqual(GG_BUTTONS);
    });
  }

  it('gg-360 は rotation で、notation 360・名前「1回転 + ボタン」・ボタンは GG 全部', () => {
    const c = byId(GG_COMMANDS, 'gg-360');
    expect(c.kind).toBe('rotation');
    expect(notationOf(c)).toBe('360');
    expect(c.name).toBe('1回転 + ボタン');
    expect([...c.buttons]).toEqual(GG_BUTTONS);
  });

  it('溜めは [1,4,7] を 25F 溜めて 6（Ver.2.0 で 30F→25F。wikiwiki・有志のまとめ）', () => {
    const c = byId(GG_COMMANDS, 'gg-[4]6');
    if (c.kind !== 'motion') throw new Error('motion ではありません');
    expect(c.steps[0]!.minHold).toBe(25);
    expect(c.steps[1]!.minHold).toBeUndefined();
  });

  it('手の間・ボタンまでの猶予・モーション全体が表のとおり（モーション全体は手の間の合計）', () => {
    const table: [string, number[], number][] = [
      ['gg-236', [5, 10], 9],
      ['gg-214', [5, 10], 9],
      ['gg-623', [8, 12], 6],
      ['gg-41236', [5, 12, 12, 12], 11],
      ['gg-63214', [5, 12, 12, 12], 11],
      ['gg-632146', [6, 12, 12, 12, 12], 11],
      ['gg-[4]6', [10], 9],
    ];
    for (const [id, gaps, buttonWindow] of table) {
      const c = byId(GG_COMMANDS, id);
      if (c.kind !== 'motion') throw new Error('motion ではありません');
      expect([...(c.stepGaps ?? [])], id).toEqual(gaps);
      expect(c.stepGaps!.length).toBe(c.steps.length - 1);
      expect(c.buttonWindow, id).toBe(buttonWindow);
      expect(c.motionWindow, id).toBe(gaps.reduce((a, b) => a + b, 0));
    }
  });

  it('236236・214214・360 は stepGaps を持たず、共通の値のまま（モーション 25・25・40、ボタン 6）', () => {
    for (const id of ['gg-236236', 'gg-214214']) {
      const c = byId(GG_COMMANDS, id);
      expect(c, id).toMatchObject({ motionWindow: 25, buttonWindow: 6 });
      expect(c, id).not.toHaveProperty('stepGaps');
    }
    const c360 = byId(GG_COMMANDS, 'gg-360');
    expect(c360).toMatchObject({ motionWindow: 40 });
    expect(c360).not.toHaveProperty('stepGaps');
  });

  it('スト6 のコマンドは stepGaps を持たない（値が変わらない）', () => {
    for (const c of [...SF6_COMMANDS, ...SF6_MOTIONS]) expect(c, c.id).not.toHaveProperty('stepGaps');
  });

  it('id が重複しない', () => {
    expect(new Set(GG_COMMANDS.map((c) => c.id)).size).toBe(GG_COMMANDS.length);
  });
});

describe('GG のコマンドを素直に入れてボタンを押すと成立する (受け入れ条件 2)', () => {
  const GG_BUTTONS = ['P', 'K', 'S', 'HS', 'D'];
  const f = (dir: Direction, buttons: string[] = []): FrameInput => ({ dir, buttons });

  /** 方向の並びの最後のフレームでボタンを押す */
  function motionHistory(dirs: Direction[], button: string): FrameInput[] {
    return dirs.map((d, i) => f(d, i === dirs.length - 1 ? [button] : []));
  }

  const cases: [string, Direction[]][] = [
    ['gg-236', [2, 3, 6]],
    ['gg-214', [2, 1, 4]],
    ['gg-623', [6, 2, 3]],
    ['gg-41236', [4, 1, 2, 3, 6]],
    ['gg-63214', [6, 3, 2, 1, 4]],
    ['gg-632146', [6, 3, 2, 1, 4, 6]],
    ['gg-236236', [2, 3, 6, 2, 3, 6]],
    ['gg-214214', [2, 1, 4, 2, 1, 4]],
  ];

  for (const [id, dirs] of cases) {
    it(`${id} は、5 つのどのボタンでも成立する`, () => {
      const c = byId(GG_COMMANDS, id);
      for (const b of GG_BUTTONS) {
        expect(analyzeAttempt(motionHistory(dirs, b), c)).toMatchObject({ ok: true });
      }
    });
  }

  it('gg-[4]6 は、4 を 40F 溜めて 6 とボタンで成立し、溜めが短いと成立しない', () => {
    const c = byId(GG_COMMANDS, 'gg-[4]6');
    const charge = (n: number, b: string) => [
      ...Array.from({ length: n }, () => f(4)),
      f(6, [b]),
    ];
    for (const b of GG_BUTTONS) {
      expect(analyzeAttempt(charge(40, b), c)).toMatchObject({ ok: true });
    }
    expect(analyzeAttempt(charge(10, 'P'), c)).toMatchObject({ ok: false });
  });

  it('gg-360 は、4,2,6,8 と同時のボタンで成立する', () => {
    const c = byId(GG_COMMANDS, 'gg-360');
    for (const b of GG_BUTTONS) {
      expect(analyzeAttempt([f(4), f(2), f(6), f(8, [b])], c)).toMatchObject({ ok: true });
    }
  });

  it('SF6 のボタン (LP) では GG のコマンドは試行にならない（null）', () => {
    const c = byId(GG_COMMANDS, 'gg-236');
    expect(analyzeAttempt(motionHistory([2, 3, 6], 'LP'), c)).toBeNull();
  });
});

describe('SF6_MOTIONS と SF6_RULES (第6段階 受け入れ条件 1)', () => {
  const ALL6 = ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'];
  const readCommand = (text: string) => {
    const r = parseStep(text, SF6_RULES);
    if (!r.ok) throw new Error(`読めませんでした: ${text} (${r.error})`);
    if (r.input.kind !== 'command') throw new Error(`${text} がコマンドではありません`);
    return r.input;
  };
  const shapeOf = (c: CommandDef) => {
    const { id: _id, name: _name, buttons: _buttons, ...rest } = c as CommandDef & Record<string, unknown>;
    return rest;
  };

  it('SF6_MOTIONS は 10 個の表記で、ボタンはスト6 の 6 つ全部', () => {
    expect(SF6_MOTIONS.map(notationOf).sort()).toEqual(
      ['236', '214', '623', '41236', '63214', '[4]6', '[2]8', '360', '236236', '214214'].sort(),
    );
    for (const c of SF6_MOTIONS) expect([...c.buttons].sort()).toEqual([...ALL6].sort());
  });

  it('SF6_MOTIONS の方向・窓・溜めは、SF6_COMMANDS の同じ表記と同じ', () => {
    for (const old of SF6_COMMANDS) {
      const m = SF6_MOTIONS.find((c) => notationOf(c) === notationOf(old));
      if (!m) throw new Error(`SF6_MOTIONS に ${notationOf(old)} がありません`);
      expect(shapeOf(m)).toEqual(shapeOf(old));
    }
  });

  it('236236・214214 は motionWindow 25、buttonWindow 6、方向は 236 / 214 を 2 回', () => {
    for (const [n, dirs] of [
      ['236236', [[2], [3], [6], [2], [3], [6]]],
      ['214214', [[2], [1], [4], [2], [1], [4]]],
    ] as const) {
      const m = SF6_MOTIONS.find((c) => notationOf(c) === n);
      if (!m) throw new Error(`SF6_MOTIONS に ${n} がありません`);
      expect(m).toMatchObject({ motionWindow: 25, buttonWindow: 6 });
      expect(dirsOf(m)).toEqual(dirs.map((d) => [...d]));
    }
  });

  it('SF6_RULES で 236K・623K・214P・236236K・214214P・236236P が読める', () => {
    const cases: [string, string[]][] = [
      ['236K', ['LK', 'MK', 'HK']],
      ['623K', ['LK', 'MK', 'HK']],
      ['214P', ['LP', 'MP', 'HP']],
      ['236236K', ['LK', 'MK', 'HK']],
      ['214214P', ['LP', 'MP', 'HP']],
      ['236236P', ['LP', 'MP', 'HP']],
    ];
    for (const [text, buttons] of cases) {
      expect([...readCommand(text).buttons].sort()).toEqual([...buttons].sort());
    }
  });

  it('236K は 236P と同じ方向・窓、623K は 623P と同じ (buttonWindow 6)', () => {
    expect(shapeOf(readCommand('236K').command)).toEqual(shapeOf(byId(SF6_COMMANDS, '236P')));
    expect(shapeOf(readCommand('623K').command)).toEqual(shapeOf(byId(SF6_COMMANDS, '623P')));
    expect(readCommand('623K').command).toMatchObject({ motionWindow: 15, buttonWindow: 6 });
  });

  it('236236K・214214P の窓は 25 / 6', () => {
    expect(readCommand('236236K').command).toMatchObject({ motionWindow: 25, buttonWindow: 6 });
    expect(readCommand('214214P').command).toMatchObject({ motionWindow: 25, buttonWindow: 6 });
  });

  it('いま読める表記は、同じ方向・窓・ボタンで読める', () => {
    const cases: [string, string, string[]][] = [
      ['236HP', '236P', ['HP']],
      ['214LP', '214P', ['LP']],
      ['623MP', '623P', ['MP']],
      ['41236HP', '41236P', ['HP']],
      ['63214LP', '63214P', ['LP']],
      ['[4]6P', '[4]6P', ['LP', 'MP', 'HP']],
      ['[2]8HK', '[2]8K', ['HK']],
      ['360LP', '360P', ['LP']],
    ];
    for (const [text, id, buttons] of cases) {
      const i = readCommand(text);
      expect(shapeOf(i.command)).toEqual(shapeOf(byId(SF6_COMMANDS, id)));
      expect([...i.buttons].sort()).toEqual([...buttons].sort());
    }
  });

  it('SF6_COMMANDS は変わらない (8 個・同じ id と順)', () => {
    expect(SF6_COMMANDS.map((c) => c.id)).toEqual([
      '236P', '214P', '623P', '41236P', '63214P', '[4]6P', '[2]8K', '360P',
    ]);
  });
});
