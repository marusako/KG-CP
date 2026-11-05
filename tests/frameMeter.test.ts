import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/core/characters';
import { fighterDataFor } from '../src/core/frameData';
import type { DummyMode, MoveFrames } from '../src/core/frameData';
import { INITIAL_DUMMY, stepDummy } from '../src/core/dummy';
import type { DummyState } from '../src/core/dummy';
import { INITIAL_FIGHTER, stepFighter } from '../src/core/fighter';
import type { FighterPhase, FighterState } from '../src/core/fighter';
import {
  EMPTY_FRAME_METER,
  FRAME_METER_BREAK,
  FRAME_METER_LEAD,
  FRAME_METER_MAX,
  isEarlyPress,
  labeledSegments,
  meterKindOf,
  syncMoveTexts,
  stateSegments,
  stepFrameMeter,
  stopFrameMeter,
} from '../src/core/frameMeter';
import type { FrameMeterCell, FrameMeterState, StateKind } from '../src/core/frameMeter';
import { PROFILES } from '../src/core/profiles';
import { msg } from '../src/i18n/messages';
import type { FrameInput } from '../src/core/types';

const cammyData = fighterDataFor('cammy')!;
const cammyChar = CHARACTERS.find((c) => c.id === 'cammy')!;
const cammy = { data: cammyData, character: cammyChar };
const mk = (input: string): MoveFrames => cammyData.moves.find((m) => m.input === input)!;
const lp = mk('5LP');
const lp2 = mk('2LP');

const N: FrameInput = { dir: 5, buttons: [] };
const LP: FrameInput = { dir: 5, buttons: ['LP'] };
const rep = (n: number, f: FrameInput): FrameInput[] => Array.from({ length: n }, () => f);
const times = (n: number, k: StateKind): StateKind[] => Array.from({ length: n }, () => k);

/**
 * 本物の stepFighter でキャラを動かしながら、1 フレームずつ stepFrameMeter に渡す。
 * 各フレームの帯を返す（character: null ならキャラなし）
 */
function run(
  inputs: readonly FrameInput[],
  opts: { character?: typeof cammy | null; meter?: FrameMeterState } = {},
): FrameMeterState[] {
  const character = opts.character === undefined ? cammy : opts.character;
  let fighter: FighterState = INITIAL_FIGHTER;
  let meter = opts.meter ?? EMPTY_FRAME_METER;
  const history: FrameInput[] = [];
  const out: FrameMeterState[] = [];
  for (const f of inputs) {
    history.push(f);
    const next = stepFighter(fighter, history, character, PROFILES.sf6, PROFILES.sf6.inputBuffer);
    meter = stepFrameMeter(meter, fighter, next, history);
    out.push(meter);
    fighter = next;
  }
  return out;
}
const last = <T>(xs: readonly T[]): T => xs[xs.length - 1]!;
const states = (m: FrameMeterState) => m.cells.map((c) => c.state);

const at = (phase: FighterPhase, move: MoveFrames | null = null): FighterState => ({
  ...INITIAL_FIGHTER,
  phase,
  frame: 0,
  move,
});

const cellOf = (state: StateKind, pressed: string[] = [], held: string[] = pressed): FrameMeterCell => ({
  state,
  dir: 5,
  pressed,
  held,
});

describe('定数と EMPTY_FRAME_METER', () => {
  it('帯の上限 120・区切り 30・先頭の入力 15', () => {
    expect(FRAME_METER_MAX).toBe(120);
    expect(FRAME_METER_BREAK).toBe(30);
    expect(FRAME_METER_LEAD).toBe(15);
  });

  it('空の帯は、積んでおらず、マスも技の位置もない', () => {
    // lead・cut は第11段階のレビュー後に足した（数字を付ける区間を決めるため）
    expect(EMPTY_FRAME_METER).toEqual({
      cells: [],
      recording: false,
      freeRun: 0,
      starts: [],
      lead: 0,
      cut: false,
      advantage: null, // 第13段階で足した
    });
  });
});

describe('stepFrameMeter (第11段階 受け入れ条件 1)', () => {
  it('止まっているとき、ボタンを押していなければ同じ state（同じ参照）を返す', () => {
    expect(stepFrameMeter(EMPTY_FRAME_METER, at('idle'), at('idle'), [N])).toBe(EMPTY_FRAME_METER);
    const dir6: FrameInput = { dir: 6, buttons: [] };
    expect(stepFrameMeter(EMPTY_FRAME_METER, at('idle'), at('walkForward'), [N, dir6])).toBe(EMPTY_FRAME_METER);
    const ms = run(rep(10, N));
    for (const m of ms) expect(m).toBe(EMPTY_FRAME_METER);
  });

  it('ボタンを押したフレームで帯が始まり、先頭にその前の入力が 15 フレームつく', () => {
    const ms = run([...rep(20, N), LP]);
    const m = last(ms);
    expect(m.recording).toBe(true);
    expect(m.cells).toHaveLength(FRAME_METER_LEAD + 1);
    expect(states(m).slice(0, FRAME_METER_LEAD)).toEqual(times(FRAME_METER_LEAD, 'free'));
    expect(m.cells[FRAME_METER_LEAD]!.pressed).toEqual(['LP']);
    expect(m.cells[FRAME_METER_LEAD]!.state).toBe('startup');
  });

  it('先頭の 15 フレームは、押す直前の 15 フレームの入力そのもの', () => {
    // 4 と 6 を交互に入れる（どちらも歩きで、メーターでは free）
    const lead: FrameInput[] = Array.from({ length: 20 }, (_, i) => ({ dir: i % 2 === 0 ? 4 : 6, buttons: [] }));
    const m = last(run([...lead, LP]));
    expect(m.cells.slice(0, FRAME_METER_LEAD).map((c) => c.dir)).toEqual(lead.slice(5).map((f) => f.dir));
    expect(m.cells.slice(0, FRAME_METER_LEAD).every((c) => c.pressed.length === 0 && c.held.length === 0)).toBe(true);
  });

  it('history が短ければ、ある分だけ先頭につく', () => {
    const m = last(run([N, N, N, LP]));
    expect(m.cells).toHaveLength(4);
    expect(states(m).slice(0, 3)).toEqual(['free', 'free', 'free']);
    const m1 = last(run([LP]));
    expect(m1.cells).toHaveLength(1);
    expect(m1.cells[0]!.pressed).toEqual(['LP']);
  });

  it('技が始まったフレームで starts に足される', () => {
    const ms = run([...rep(20, N), LP, ...rep(5, N)]);
    const m = last(ms);
    expect(m.starts).toHaveLength(1);
    expect(m.starts[0]!.index).toBe(FRAME_METER_LEAD);
    expect(m.starts[0]!.move.input).toBe('5LP');
    // 始まる前は starts にない
    expect(ms[19]!.starts).toEqual([]);
  });

  it('キャミィの 5LP は、上の段が startup 3・active 3・recovery 7 と並ぶ', () => {
    const m = last(run([...rep(20, N), LP, ...rep(12, N)]));
    expect(states(m).slice(FRAME_METER_LEAD)).toEqual([
      ...times(3, 'startup'),
      ...times(3, 'active'),
      ...times(7, 'recovery'),
    ]);
    // 押したのは技の最初のマスだけ
    expect(m.cells.filter((c) => c.pressed.length > 0)).toHaveLength(1);
  });

  it('5LP のあと 2F 動いてから 2LP を出すと、1 本につながる', () => {
    const inputs = [
      ...rep(20, N),
      LP,
      ...rep(12, N), // 5LP の残り（合計 13F）
      ...rep(2, N), // 動ける 2F
      { dir: 2, buttons: ['LP'] } as FrameInput,
      ...rep(lp2.startup + lp2.active + lp2.recovery, N),
    ];
    const m = last(run(inputs));
    expect(states(m).slice(FRAME_METER_LEAD, FRAME_METER_LEAD + 13 + 2 + lp2.startup + 1)).toEqual([
      ...times(3, 'startup'),
      ...times(3, 'active'),
      ...times(7, 'recovery'),
      ...times(2, 'free'),
      ...times(lp2.startup, 'startup'),
      'active',
    ]);
    expect(m.starts.map((s) => [s.index, s.move.input])).toEqual([
      [FRAME_METER_LEAD, '5LP'],
      [FRAME_METER_LEAD + 15, '2LP'],
    ]);
    expect(m.recording).toBe(true);
  });

  it('free でボタンを押さない状態が 30F 続くと止まり、その 30F は帯から消える', () => {
    // 5LP は 13F。13F 目（0 から数えて 13 番目）から idle で、そこから free が数えられる
    const ms = run([...rep(20, N), LP, ...rep(12, N), ...rep(FRAME_METER_BREAK, N)]);
    const startFrame = 20;
    const firstFree = startFrame + 13;
    const stopAt = firstFree + FRAME_METER_BREAK - 1;
    expect(ms[stopAt - 1]!.recording).toBe(true);
    expect(ms[stopAt - 1]!.freeRun).toBe(FRAME_METER_BREAK - 1);
    const stopped = ms[stopAt]!;
    expect(stopped.recording).toBe(false);
    // 末尾の 30F が消え、5LP の 13 マスで終わる
    expect(stopped.cells).toHaveLength(FRAME_METER_LEAD + 13);
    expect(last(stopped.cells as FrameMeterCell[]).state).toBe('recovery');
  });

  it('止まったあとは、何フレーム経っても同じ state（同じ参照）を返す', () => {
    const ms = run([...rep(20, N), LP, ...rep(12, N), ...rep(FRAME_METER_BREAK, N), ...rep(50, N)]);
    const stopped = ms[20 + 13 + FRAME_METER_BREAK - 1]!;
    expect(stopped.recording).toBe(false);
    expect(last(ms)).toBe(stopped);
  });

  it('止まったあと、次にボタンを押すと新しい帯が始まる', () => {
    const ms = run([...rep(20, N), LP, ...rep(12, N), ...rep(FRAME_METER_BREAK + 10, N), ...rep(3, N), LP]);
    const m = last(ms);
    expect(m.recording).toBe(true);
    expect(m.starts).toHaveLength(1);
    expect(m.cells).toHaveLength(FRAME_METER_LEAD + 1);
  });

  it('free の間にボタンを押すと（技が出なくても）、freeRun は 0 に戻る', () => {
    // キャラなし: 技は出ない
    const ms = run([...rep(5, N), LP, ...rep(10, N), LP, ...rep(4, N)], { character: null });
    expect(ms[5]!.recording).toBe(true);
    expect(ms[5]!.freeRun).toBe(0);
    expect(ms[15]!.freeRun).toBe(10);
    expect(ms[16]!.freeRun).toBe(0);
    expect(last(ms).freeRun).toBe(4);
  });

  it('ボタンを離すまで、押しっぱなしの間は freeRun が 0 のまま', () => {
    const ms = run([...rep(5, N), ...rep(8, LP), ...rep(3, N)], { character: null });
    expect(ms[5]!.freeRun).toBe(0);
    expect(ms[12]!.freeRun).toBe(0);
    expect(last(ms).freeRun).toBe(3);
  });

  it('ボタンを押し直した分、止まるのが遅くなる', () => {
    const inputs = [...rep(5, N), LP, ...rep(20, N), LP, ...rep(FRAME_METER_BREAK - 1, N)];
    const ms = run(inputs, { character: null });
    expect(last(ms).recording).toBe(true);
    const more = run([...inputs, N], { character: null });
    expect(last(more).recording).toBe(false);
  });

  it('120 マスを超えたら古いほうを捨て、starts の位置もずれる', () => {
    // 20 フレームごとに 5LP を 8 回。積み上がる長さは 15 + 160 = 175 マス
    const cycle = [LP, ...rep(19, N)];
    const inputs = [...rep(20, N), ...Array.from({ length: 8 }, () => cycle).flat()];
    const m = last(run(inputs));
    expect(m.cells).toHaveLength(FRAME_METER_MAX);
    expect(m.recording).toBe(true);
    // 捨てた分は 175 - 120 = 55。残る技の開始は 15 + 20j のうち 55 以上のもの
    expect(m.starts.map((s) => s.index)).toEqual([0, 20, 40, 60, 80, 100]);
    for (const s of m.starts) {
      expect(m.cells[s.index]!.state).toBe('startup');
      expect(m.cells[s.index]!.pressed).toEqual(['LP']);
    }
  });

  it('キャラなし（技が出ない）でも、ボタンを押せば下の段の帯ができる', () => {
    const ms = run([...rep(20, N), { dir: 6, buttons: ['LP'] }, { dir: 6, buttons: ['LP'] }, N], { character: null });
    const m = last(ms);
    expect(m.recording).toBe(true);
    expect(m.cells).toHaveLength(FRAME_METER_LEAD + 3);
    expect(states(m).every((s) => s === 'free')).toBe(true);
    expect(m.starts).toEqual([]);
    expect(m.cells[FRAME_METER_LEAD]!.pressed).toEqual(['LP']);
    expect(m.cells[FRAME_METER_LEAD]!.dir).toBe(6);
    expect(m.cells[FRAME_METER_LEAD + 1]!.pressed).toEqual([]);
    expect(m.cells[FRAME_METER_LEAD + 1]!.held).toEqual(['LP']);
  });
});

describe('stopFrameMeter (第11段階 受け入れ条件 2)', () => {
  it('積んでいる途中なら recording を false にし、cells はそのまま', () => {
    const m = last(run([...rep(20, N), LP, ...rep(5, N)]));
    expect(m.recording).toBe(true);
    const s = stopFrameMeter(m);
    expect(s.recording).toBe(false);
    expect(s.cells).toEqual(m.cells);
    expect(s.starts).toEqual(m.starts);
  });

  it('止まっていれば同じ state（同じ参照）', () => {
    expect(stopFrameMeter(EMPTY_FRAME_METER)).toBe(EMPTY_FRAME_METER);
    const stopped = stopFrameMeter(last(run([LP, N])));
    expect(stopFrameMeter(stopped)).toBe(stopped);
  });

  it('止めたあとは、ボタンを押さない限り帯は変わらない', () => {
    const stopped = stopFrameMeter(last(run([...rep(3, N), LP, N])));
    const next = stepFrameMeter(stopped, at('idle'), at('idle'), [N]);
    expect(next).toBe(stopped);
  });
});

describe('stateSegments (第11段階 受け入れ条件 3)', () => {
  it('同じ種類の続きを区間にする', () => {
    const cells = [
      ...times(2, 'free'),
      ...times(3, 'startup'),
      ...times(3, 'active'),
      ...times(7, 'recovery'),
    ].map((s) => cellOf(s));
    expect(stateSegments(cells)).toEqual([
      { state: 'free', start: 0, length: 2 },
      { state: 'startup', start: 2, length: 3 },
      { state: 'active', start: 5, length: 3 },
      { state: 'recovery', start: 8, length: 7 },
    ]);
  });

  it('空なら空', () => {
    expect(stateSegments([])).toEqual([]);
  });

  it('1 マスだけの区間も出る。離れた同じ種類は別の区間', () => {
    const cells = (['free', 'startup', 'free'] as StateKind[]).map((s) => cellOf(s));
    expect(stateSegments(cells)).toEqual([
      { state: 'free', start: 0, length: 1 },
      { state: 'startup', start: 1, length: 1 },
      { state: 'free', start: 2, length: 1 },
    ]);
  });

  it('本物の帯でも、5LP のあとに free が続く形になる', () => {
    const m = last(run([...rep(20, N), LP, ...rep(14, N)]));
    expect(stateSegments(m.cells.slice(FRAME_METER_LEAD))).toEqual([
      { state: 'startup', start: 0, length: 3 },
      { state: 'active', start: 3, length: 3 },
      { state: 'recovery', start: 6, length: 7 },
      { state: 'free', start: 13, length: 2 },
    ]);
  });
});

describe('isEarlyPress (第11段階 受け入れ条件 4)', () => {
  it('技の途中・ジャンプ中に新しく押したマスは true', () => {
    for (const s of ['startup', 'active', 'recovery', 'jump'] as StateKind[]) {
      expect(isEarlyPress(cellOf(s, ['LP']))).toBe(true);
    }
  });

  it('free で押したマスは false', () => {
    expect(isEarlyPress(cellOf('free', ['LP']))).toBe(false);
  });

  it('押していない（押しっぱなしの続きも含む）マスは false', () => {
    for (const s of ['free', 'startup', 'active', 'recovery', 'jump'] as StateKind[]) {
      expect(isEarlyPress(cellOf(s))).toBe(false);
      expect(isEarlyPress(cellOf(s, [], ['LP']))).toBe(false);
    }
  });

  it('本物の帯で、5LP の硬直中に押した LP のマスだけが true', () => {
    const inputs = [...rep(20, N), LP, ...rep(8, N), LP, ...rep(10, N)];
    const m = last(run(inputs));
    const early = m.cells.map((c, i) => [i, isEarlyPress(c)] as const).filter(([, e]) => e);
    expect(early.map(([i]) => i)).toEqual([FRAME_METER_LEAD + 9]);
    // 先行入力で 2 つ目の技が本当に出た: 動けるようになった 13 マス目から始まり、そのマスには枠が付かない（第11段階のレビュー後）
    expect(m.starts.map((s) => s.index)).toEqual([FRAME_METER_LEAD, FRAME_METER_LEAD + 13]);
    expect(m.cells[FRAME_METER_LEAD + 13]!.moveStart).toBe(true);
    expect(isEarlyPress(m.cells[FRAME_METER_LEAD + 13]!)).toBe(false);
  });

  it('動けるようになったフレームで押すと、押したマス = 技が始まったマスで、枠は付かない', () => {
    const inputs = [...rep(20, N), LP, ...rep(12, N), LP, ...rep(10, N)];
    const m = last(run(inputs));
    expect(m.starts.map((s) => s.index)).toEqual([FRAME_METER_LEAD, FRAME_METER_LEAD + 13]);
    expect(m.cells.some((c) => isEarlyPress(c))).toBe(false);
  });
});

describe('meterKindOf (第11段階 受け入れ条件 5)', () => {
  const table: [FighterPhase, StateKind][] = [
    ['idle', 'free'],
    ['crouch', 'free'],
    ['walkForward', 'free'],
    ['walkBack', 'free'],
    ['prejump', 'jump'],
    ['air', 'jump'],
    ['landing', 'jump'],
    ['startup', 'startup'],
    ['active', 'active'],
    ['recovery', 'recovery'],
  ];
  for (const [phase, kind] of table) {
    it(`${phase} は ${kind}`, () => {
      expect(meterKindOf(at(phase, kind === 'free' || kind === 'jump' ? null : lp))).toBe(kind);
    });
  }
});

describe('文 (第11段階 受け入れ条件 7)', () => {
  it('frameMeterMoves は技の文を " → " でつなぐ。空なら空文字', () => {
    for (const l of ['ja', 'en'] as const) {
      expect(msg(l).frameMeterMoves(['A', 'B'])).toBe('A → B');
      expect(msg(l).frameMeterMoves(['A', 'B', 'C'])).toBe('A → B → C');
      expect(msg(l).frameMeterMoves(['A'])).toBe('A');
      expect(msg(l).frameMeterMoves([])).toBe('');
    }
  });

  it('moveMeterText 日本語: 技名 — 発生 4F / 持続 3F / 硬直 7F / 全体 13F（発生は発生前 + 1）', () => {
    expect(msg('ja').moveMeterText('立ち弱P (5LP)', lp)).toBe('立ち弱P (5LP) — 発生 4F / 持続 3F / 硬直 7F / 全体 13F');
  });

  it('moveMeterText 英語: Standing LP (5LP) — Startup 4F / Active 3F / Recovery 7F / Total 13F', () => {
    expect(msg('en').moveMeterText('Standing LP (5LP)', lp)).toBe(
      'Standing LP (5LP) — Startup 4F / Active 3F / Recovery 7F / Total 13F',
    );
  });

  it('moveMeterText 別の技（236HK）でも同じ形で、発生は 15、全体は 51', () => {
    expect(msg('ja').moveMeterText('X (236HK)', mk('236HK'))).toBe('X (236HK) — 発生 15F / 持続 16F / 硬直 21F / 全体 51F');
    expect(msg('en').moveMeterText('X (236HK)', mk('236HK'))).toBe(
      'X (236HK) — Startup 15F / Active 16F / Recovery 21F / Total 51F',
    );
  });

  it('凡例 frameMeterLegend が日本語・英語にあり、空でない', () => {
    // 第13段階で、あとに相手の色の説明が足される（tests/i18n.test.ts で確かめる）
    expect(msg('ja').frameMeterLegend).toContain(
      '緑: 発生（数 + 1 が発生のフレーム）　赤: 持続　青: 硬直　灰: 動ける　水色: ジャンプ　橙の枠: 先行入力',
    );
    expect(msg('en').frameMeterLegend.length).toBeGreaterThan(0);
    expect(msg('en').frameMeterLegend).not.toBe(msg('ja').frameMeterLegend);
  });

  it('案内 frameMeterEmpty が日本語・英語にある', () => {
    expect(msg('ja').frameMeterEmpty).toBe('ボタンを押すと、ここに帯が出ます');
    expect(msg('en').frameMeterEmpty).toBe('Press a button to start the meter');
  });
});


describe('lead・cut と labeledSegments（数字を付ける区間。第11段階のレビュー後）', () => {
  it('帯を始めたとき lead は先頭の入力だけの部分の長さ。cut は false', () => {
    const m = last(run([...rep(20, N), LP]));
    expect(m.lead).toBe(FRAME_METER_LEAD);
    expect(m.cut).toBe(false);
  });

  it('history が短ければ、lead はある分だけ', () => {
    const m = last(run([...rep(3, N), LP]));
    expect(m.lead).toBe(3);
  });

  it('先頭の入力だけの部分には数字を付けない。技と、技と技のすき間には付ける', () => {
    // 5LP → 2F 動ける → 2LP
    const inputs = [...rep(20, N), LP, ...rep(14, N), LP, ...rep(3, N)];
    const m = last(run(inputs));
    const labels = labeledSegments(m).map((s) => [s.state, s.length]);
    expect(labels.slice(0, 5)).toEqual([
      ['startup', 3],
      ['active', 3],
      ['recovery', 7],
      ['free', 2],
      ['startup', 3],
    ]);
    expect(labeledSegments(m)[0]!.start).toBe(FRAME_METER_LEAD);
  });

  it('120 マスを超えて古いほうを捨てたら cut が true になり、lead は捨てた分だけ減る（0 より下にはならない）', () => {
    // 5LP を 2F すき間でつなぎ続けて、帯を 120 マスより長くする
    const chain: FrameInput[] = [...rep(20, N)];
    for (let i = 0; i < 12; i++) chain.push(LP, ...rep(14, N));
    const ms = run(chain);
    const firstCut = ms.findIndex((m) => m.cut);
    expect(firstCut).toBeGreaterThan(0);
    const m = ms[firstCut]!;
    expect(m.cells).toHaveLength(FRAME_METER_MAX);
    expect(m.lead).toBe(FRAME_METER_LEAD - 1);
    expect(last(ms).lead).toBe(0);
  });

  it('cut で lead が 0 のとき、途中で切れた先頭の区間には数字を付けない', () => {
    const chain: FrameInput[] = [...rep(20, N)];
    for (let i = 0; i < 12; i++) chain.push(LP, ...rep(14, N));
    const m = last(run(chain));
    expect(m.cut).toBe(true);
    expect(m.lead).toBe(0);
    const all = stateSegments(m.cells);
    const labeled = labeledSegments(m);
    expect(labeled).toEqual(all.slice(1));
  });
});

describe('syncMoveTexts（帯の技と、技の文の対応。第11段階のレビュー後）', () => {
  const textOf = (move: MoveFrames) => `T:${move.input}`;

  it('技が始まったフレームで文が 1 つ増える。新しい帯では空から', () => {
    const ms = run([...rep(20, N), LP, ...rep(14, N), LP]);
    let texts: readonly string[] = [];
    let prev = EMPTY_FRAME_METER;
    for (const m of ms) {
      texts = syncMoveTexts(texts, prev, m, textOf);
      prev = m;
    }
    expect(texts).toEqual(['T:5LP', 'T:5LP']);
  });

  it('帯が変わらないときは同じ配列（同じ参照）を返す', () => {
    const texts = ['T:5LP'];
    const m = last(run([...rep(20, N), LP]));
    expect(syncMoveTexts(texts, m, m, textOf)).toBe(texts);
  });

  it('区切れて新しい帯が始まったら、前の帯の文は捨てる', () => {
    const inputs = [...rep(20, N), LP, ...rep(13 + FRAME_METER_BREAK, N), { dir: 2, buttons: ['LP'] } as FrameInput];
    const ms = run(inputs);
    let texts: readonly string[] = [];
    let prev = EMPTY_FRAME_METER;
    for (const m of ms) {
      texts = syncMoveTexts(texts, prev, m, textOf);
      prev = m;
    }
    expect(texts).toEqual(['T:2LP']);
  });

  it('120 マスを超えて古い技が帯から外れたら、その文も捨てる（数と順が starts と同じ）', () => {
    const chain: FrameInput[] = [...rep(20, N)];
    for (let i = 0; i < 12; i++) chain.push(i % 2 === 0 ? LP : { dir: 2, buttons: ['LP'] }, ...rep(14, N));
    const ms = run(chain);
    let texts: readonly string[] = [];
    let prev = EMPTY_FRAME_METER;
    for (const m of ms) {
      texts = syncMoveTexts(texts, prev, m, textOf);
      prev = m;
      expect(texts.length).toBe(m.starts.length);
      expect(texts).toEqual(m.starts.map((s) => textOf(s.move)));
    }
  });
});

// ---- 第13段階: 相手の段・contact・advantage・区切り（受け入れ条件 4・6） ----

const bridgetData = fighterDataFor('bridget')!;
const bridget = { data: bridgetData, character: CHARACTERS.find((c) => c.id === 'bridget')! };

/**
 * 本物の stepFighter → stepDummy → stepFrameMeter を 1 フレームずつつなぐ。
 * 先頭の free（N）20 フレームは、呼ぶ側が inputs に入れる
 */
function runVs(
  inputs: readonly FrameInput[],
  mode: DummyMode,
  who: { c: typeof cammy; rules: typeof PROFILES.sf6 } = { c: cammy, rules: PROFILES.sf6 },
): FrameMeterState[] {
  let fighter: FighterState = INITIAL_FIGHTER;
  let dummy: DummyState = INITIAL_DUMMY;
  let meter = EMPTY_FRAME_METER;
  const history: FrameInput[] = [];
  const out: FrameMeterState[] = [];
  for (const f of inputs) {
    history.push(f);
    const stepped = stepFighter(fighter, history, who.c, who.rules, who.rules.inputBuffer);
    const r = stepDummy(dummy, stepped, mode);
    meter = stepFrameMeter(meter, fighter, r.fighter, history, { dummy: r.dummy, contact: r.contact });
    out.push(meter);
    fighter = r.fighter;
    dummy = r.dummy;
  }
  return out;
}
const advOf = (ms: FrameMeterState[]) => ms.map((m) => m.advantage);
const HK2: FrameInput = { dir: 2, buttons: ['HK'] };
const S = 20; // 技を押す前の free の長さ。以下の「フレーム n」は、この S を足した入力の位置

describe('stepFrameMeter: 相手の段・contact (第13段階 受け入れ条件 4)', () => {
  it('5LP ヒット: 相手の段は、持続の 1 フレーム目（技の 3）から 15 マス hitstun。ほかは付かない', () => {
    // 帯の先頭 15 マスは入力だけの部分。技は帯の 15 マス目から。当たるのは技の 3 フレーム目 = 帯の 18 マス目
    const m = last(runVs([...rep(S, N), LP, ...rep(40, N)], 'hit'));
    const opp = m.cells.map((c) => c.opponent);
    const t = FRAME_METER_LEAD + 3;
    expect(opp.slice(0, t).every((o) => o === undefined)).toBe(true);
    expect(opp.slice(t, t + 15)).toEqual(Array.from({ length: 15 }, () => 'hitstun'));
    expect(opp.slice(t + 15).every((o) => o === undefined)).toBe(true);
  });

  it('5LP ガード: blockstun 8 マス', () => {
    const m = last(runVs([...rep(S, N), LP, ...rep(40, N)], 'block'));
    const t = FRAME_METER_LEAD + 3;
    expect(m.cells.map((c) => c.opponent).slice(t, t + 9)).toEqual([...Array.from({ length: 8 }, () => 'blockstun'), undefined]);
  });

  it('2HK ヒット: down が 65 マス（技の 8 から。帯は 15 + 73 = 88 マス以上）', () => {
    const m = last(runVs([...rep(S, N), HK2, ...rep(80, N)], 'hit'));
    const t = FRAME_METER_LEAD + 8;
    const opp = m.cells.map((c) => c.opponent);
    expect(opp.slice(t, t + 65).every((o) => o === 'down')).toBe(true);
    expect(opp[t - 1]).toBeUndefined();
    expect(opp[t + 65]).toBeUndefined();
  });

  it('当たったフレームのマスにだけ contact が付く。技の starts の最後にも同じ contact が付く', () => {
    const m = last(runVs([...rep(S, N), LP, ...rep(40, N)], 'hit'));
    const want = { kind: 'hit', knockdown: false, combo: false, advantage: 5 };
    const withContact = m.cells.map((c, i) => [i, c.contact] as const).filter(([, c]) => c !== undefined);
    expect(withContact).toEqual([[FRAME_METER_LEAD + 3, want]]);
    expect(m.starts).toHaveLength(1);
    expect(m.starts[0]!.contact).toEqual(want);
  });

  it('当たる前の帯の starts には contact がなく、当たったフレームから付く', () => {
    const ms = runVs([...rep(S, N), LP, ...rep(10, N)], 'hit');
    expect(ms[S + 2]!.starts[0]!.contact).toBeUndefined();
    expect(ms[S + 3]!.starts[0]!.contact).toMatchObject({ kind: 'hit' });
  });

  it('つながったときは、2 つ目の starts に combo: true の contact が付く', () => {
    const m = last(runVs([...rep(S, N), LP, ...rep(12, N), LP, ...rep(40, N)], 'hit'));
    expect(m.starts).toHaveLength(2);
    expect(m.starts[0]!.contact?.combo).toBe(false);
    expect(m.starts[1]!.contact?.combo).toBe(true);
  });

  it('データのない技（236LK）や、ダウン中の空振りでは contact も相手の段も付かない', () => {
    const m = last(runVs([...rep(S, N), ...[2, 3].map((d) => ({ dir: d, buttons: [] }) as FrameInput), { dir: 6, buttons: ['LK'] }, ...rep(60, N)], 'hit'));
    expect(m.starts[0]!.move.input).toBe('236LK');
    expect(m.starts[0]!.contact).toBeUndefined();
    expect(m.cells.every((c) => c.contact === undefined && c.opponent === undefined)).toBe(true);
  });

  it('5 つ目の引数を省いたら、相手はずっと free（opponent も contact も付かない）', () => {
    const m = last(run([...rep(S, N), LP, ...rep(40, N)]));
    expect(m.cells.every((c) => c.opponent === undefined && c.contact === undefined)).toBe(true);
    expect(m.starts[0]!.contact).toBeUndefined();
    expect(m.advantage).toBeNull();
  });

  it('相手が free で contact なしの引数を渡しても、省いたときと同じ帯になる', () => {
    const inputs = [...rep(S, N), LP, ...rep(14, N), HK2];
    const withFree = (() => {
      let fighter: FighterState = INITIAL_FIGHTER;
      let meter = EMPTY_FRAME_METER;
      const history: FrameInput[] = [];
      for (const f of inputs) {
        history.push(f);
        const next = stepFighter(fighter, history, cammy, PROFILES.sf6, PROFILES.sf6.inputBuffer);
        meter = stepFrameMeter(meter, fighter, next, history, { dummy: INITIAL_DUMMY, contact: null });
        fighter = next;
      }
      return meter;
    })();
    expect(withFree).toEqual(last(run(inputs)));
  });

  it('先頭に付ける入力だけの部分の相手は free', () => {
    const m = last(runVs([...rep(S, N), LP, ...rep(3, N)], 'hit'));
    expect(m.cells.slice(0, FRAME_METER_LEAD).every((c) => c.opponent === undefined)).toBe(true);
  });
});

describe('stepFrameMeter: advantage (第13段階 受け入れ条件 4)', () => {
  it('帯が始まる前・新しい帯では null', () => {
    expect(EMPTY_FRAME_METER.advantage).toBeNull();
    expect(last(runVs([...rep(S, N), LP], 'hit')).advantage).toBeNull();
  });

  it('キャミィ 5LP ヒット: キャラが動けるのは 3+3+7 = 13、相手が動けるのは 3+15 = 18。18 - 13 = +5（18 になって決まる）', () => {
    const ms = runVs([...rep(S, N), LP, ...rep(25, N)], 'hit');
    expect(ms[S + 17]!.advantage).toBeNull(); // 相手がまだ動けない
    expect(ms[S + 18]!.advantage).toBe(5);
    expect(last(ms).advantage).toBe(5);
    expect(last(ms).recording).toBe(true);
  });

  it('キャミィ 5LP ガード: 相手 3+8 = 11、キャラ 13。11 - 13 = -2（キャラが 13 に動けて決まる）', () => {
    const ms = runVs([...rep(S, N), LP, ...rep(25, N)], 'block');
    expect(ms[S + 12]!.advantage).toBeNull();
    expect(ms[S + 13]!.advantage).toBe(-2);
    expect(last(ms).advantage).toBe(-2);
  });

  it('キャミィ 2HK ヒット: キャラ 8+3+24 = 35、相手 8+65 = 73。73 - 35 = +38', () => {
    const ms = runVs([...rep(S, N), HK2, ...rep(90, N)], 'hit');
    expect(ms[S + 72]!.advantage).toBeNull();
    expect(ms[S + 73]!.advantage).toBe(38);
  });

  it('キャミィ 623LK ガード: 技は入力の 2 番目（3 のフレーム）から。キャラ 4+12+40 = 56、相手 4+16 = 20。20 - 56 = -36', () => {
    // 6, 2, 3+LK の 3 フレーム目で出る。start = S + 2
    const inputs = [...rep(S, N), ...(([6, 2] as const).map((d) => ({ dir: d, buttons: [] })) as FrameInput[]), { dir: 3, buttons: ['LK'] } as FrameInput, ...rep(70, N)];
    const ms = runVs(inputs, 'block');
    const start = S + 2;
    expect(ms[start + 55]!.advantage).toBeNull();
    expect(ms[start + 56]!.advantage).toBe(-36);
  });

  it('ブリジット 5S ヒット: キャラ 6+6+13 = 25、相手 6+32 = 38（L = 13+6+13 = 32）。38 - 25 = +13', () => {
    const S5: FrameInput = { dir: 5, buttons: ['S'] };
    const ms = runVs([...rep(S, N), S5, ...rep(50, N)], 'hit', { c: bridget, rules: PROFILES.ggst });
    expect(ms[S + 37]!.advantage).toBeNull();
    expect(ms[S + 38]!.advantage).toBe(13);
  });

  it('新しく当たっても、その技の分が決まるまで前の値のまま。決まったら新しい値', () => {
    // 5LP（0）ヒット → +5 が 18 で決まる。20 に 2HK: 当たるのは 28、キャラ 20+35 = 55 から動ける、相手は 28+65 = 93 まで down。
    // 93 で +38
    const inputs = [...rep(S, N), LP, ...rep(19, N), HK2, ...rep(90, N)];
    const ms = runVs(inputs, 'hit');
    expect(ms[S + 17]!.advantage).toBeNull();
    expect(ms[S + 18]!.advantage).toBe(5);
    expect(ms[S + 28]!.advantage).toBe(5); // 2HK が当たったフレーム
    expect(ms[S + 92]!.advantage).toBe(5);
    expect(ms[S + 93]!.advantage).toBe(38);
  });

  it('止まって新しい帯が始まったら null に戻る', () => {
    const ms = runVs([...rep(S, N), LP, ...rep(60, N), LP], 'hit');
    expect(advOf(ms).some((a) => a === 5)).toBe(true);
    expect(last(ms).advantage).toBeNull();
    expect(last(ms).cells).toHaveLength(FRAME_METER_LEAD + 1);
  });
});

describe('stepFrameMeter: 区切り (第13段階 受け入れ条件 6)', () => {
  it('相手が硬直の間は区切りの数え始めにならない: 5LP ヒットは、相手が 18 で free になってから 30 フレーム目に止まる', () => {
    // 相手なしなら、キャラが free になる 13 から 30 フレーム目（13+29 = 42）で止まる。
    // 相手ありは、キャラも相手も free になる 18 から（18+29 = 47）
    const ms = runVs([...rep(S, N), LP, ...rep(60, N)], 'hit');
    expect(ms[S + 42]!.recording).toBe(true);
    expect(ms[S + 46]!.recording).toBe(true);
    expect(ms[S + 47]!.recording).toBe(false);
  });

  it('相手がいないとき（5 つ目の引数なし）は、今までどおり 42 で止まる', () => {
    const ms = run([...rep(S, N), LP, ...rep(60, N)]);
    expect(ms[S + 41]!.recording).toBe(true);
    expect(ms[S + 42]!.recording).toBe(false);
  });

  it('2HK のダウン中（8〜72）は、キャラが 35 から free でも止まらない。相手が 73 で free になって 30 フレーム目（102）に止まる', () => {
    const ms = runVs([...rep(S, N), HK2, ...rep(110, N)], 'hit');
    expect(ms[S + 35 + 30]!.recording).toBe(true); // 相手なしなら止まる位置（35+29 = 64 を過ぎている）
    expect(ms[S + 72]!.recording).toBe(true);
    expect(ms[S + 101]!.recording).toBe(true);
    expect(ms[S + 102]!.recording).toBe(false);
  });

  it('ボタンを押すと数えが戻るのは今までどおり（相手が free でも）', () => {
    // 5LP ヒット後、相手が free になって 10 フレーム経った 28 に LP を押す
    const ms = runVs([...rep(S, N), LP, ...rep(27, N), LP, ...rep(5, N)], 'hit');
    expect(ms[S + 28]!.freeRun).toBe(0);
    expect(last(ms).recording).toBe(true);
  });
});
