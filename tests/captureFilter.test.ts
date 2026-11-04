import { describe, expect, it } from 'vitest';
import {
  INITIAL_GATE,
  emptyIgnore,
  filterInput,
  gateEnterGame,
  gateFrame,
  gateSawCapturing,
  type GateState,
  type IgnoreSet,
  type PadDir,
  type RawInput,
} from '../src/input/captureFilter';

const raw = (p: {
  keys?: string[];
  freshKeys?: string[];
  padButtons?: number[];
  padDirs?: PadDir[];
}): RawInput => ({
  keys: new Set(p.keys ?? []),
  freshKeys: new Set(p.freshKeys ?? []),
  padButtons: new Set(p.padButtons ?? []),
  padDirs: new Set(p.padDirs ?? []),
});

const ign = (p: { keys?: string[]; padButtons?: number[]; padDirs?: PadDir[] }): IgnoreSet => ({
  keys: new Set(p.keys ?? []),
  padButtons: new Set(p.padButtons ?? []),
  padDirs: new Set(p.padDirs ?? []),
});

const sorted = <T>(s: ReadonlySet<T>) => [...s].sort();

describe('filterInput (受け入れ条件 8)', () => {
  it('捕まえ中は input が全部空になり、raw の全部が ignore に足される', () => {
    const r = filterInput(
      raw({ keys: ['KeyA', 'KeyB'], freshKeys: ['KeyB'], padButtons: [0, 2], padDirs: ['up', 'left'] }),
      ign({ keys: ['KeyZ'], padButtons: [5], padDirs: ['down'] }),
      true,
    );
    expect(r.input.keys.size).toBe(0);
    expect(r.input.padButtons.size).toBe(0);
    expect(r.input.padDirs.size).toBe(0);
    expect(sorted(r.ignore.keys)).toEqual(['KeyA', 'KeyB', 'KeyZ']);
    expect(sorted(r.ignore.padButtons)).toEqual([0, 2, 5]);
    expect(sorted(r.ignore.padDirs)).toEqual(['down', 'left', 'up']);
  });

  it('捕まえが終わったあとも、押し続けている間は無視が続く', () => {
    const captured = filterInput(raw({ keys: ['KeyA'], padButtons: [1], padDirs: ['right'] }), emptyIgnore(), true);
    const r = filterInput(
      raw({ keys: ['KeyA'], padButtons: [1], padDirs: ['right'] }),
      captured.ignore,
      false,
    );
    expect(r.input.keys.size).toBe(0);
    expect(r.input.padButtons.size).toBe(0);
    expect(r.input.padDirs.size).toBe(0);
    expect(sorted(r.ignore.keys)).toEqual(['KeyA']);
    expect(sorted(r.ignore.padButtons)).toEqual([1]);
    expect(sorted(r.ignore.padDirs)).toEqual(['right']);
  });

  it('離したら ignore から外れる', () => {
    const r = filterInput(raw({}), ign({ keys: ['KeyA'], padButtons: [1], padDirs: ['up'] }), false);
    expect(r.ignore.keys.size).toBe(0);
    expect(r.ignore.padButtons.size).toBe(0);
    expect(r.ignore.padDirs.size).toBe(0);
  });

  it('外れたあとに押せば input に出る', () => {
    const released = filterInput(raw({}), ign({ keys: ['KeyA'], padButtons: [1], padDirs: ['up'] }), false);
    const r = filterInput(
      raw({ keys: ['KeyA'], freshKeys: ['KeyA'], padButtons: [1], padDirs: ['up'] }),
      released.ignore,
      false,
    );
    expect(sorted(r.input.keys)).toEqual(['KeyA']);
    expect(sorted(r.input.padButtons)).toEqual([1]);
    expect(sorted(r.input.padDirs)).toEqual(['up']);
    expect(r.ignore.keys.size).toBe(0);
  });

  it('1 フレーム内の押し直し（keys にも freshKeys にも入っている）は、ignore から外れて input に出る', () => {
    const r = filterInput(raw({ keys: ['KeyA'], freshKeys: ['KeyA'] }), ign({ keys: ['KeyA'] }), false);
    expect(sorted(r.input.keys)).toEqual(['KeyA']);
    expect(r.ignore.keys.has('KeyA')).toBe(false);
  });

  it('パッドで捕まえが終わったフレームのあと、押し続けていても input に出ない', () => {
    const endFrame = filterInput(raw({ padButtons: [0], padDirs: ['down'] }), emptyIgnore(), true);
    const next = filterInput(raw({ padButtons: [0], padDirs: ['down'] }), endFrame.ignore, false);
    expect(next.input.padButtons.size).toBe(0);
    expect(next.input.padDirs.size).toBe(0);
  });

  it('無視していないキー・ボタン・方向は、そのまま input に出る', () => {
    const r = filterInput(
      raw({ keys: ['KeyA', 'KeyB'], padButtons: [0, 3], padDirs: ['up', 'left'] }),
      ign({ keys: ['KeyA'], padButtons: [0], padDirs: ['up'] }),
      false,
    );
    expect(sorted(r.input.keys)).toEqual(['KeyB']);
    expect(sorted(r.input.padButtons)).toEqual([3]);
    expect(sorted(r.input.padDirs)).toEqual(['left']);
  });

  it('引数（raw と ignore）を書き換えない', () => {
    for (const capturing of [true, false]) {
      const rw = raw({ keys: ['KeyA', 'KeyB'], freshKeys: ['KeyB'], padButtons: [0, 2], padDirs: ['up'] });
      const ig = ign({ keys: ['KeyA', 'KeyZ'], padButtons: [0, 5], padDirs: ['down'] });
      filterInput(rw, ig, capturing);
      expect(sorted(rw.keys)).toEqual(['KeyA', 'KeyB']);
      expect(sorted(rw.freshKeys)).toEqual(['KeyB']);
      expect(sorted(rw.padButtons)).toEqual([0, 2]);
      expect(sorted(rw.padDirs)).toEqual(['up']);
      expect(sorted(ig.keys)).toEqual(['KeyA', 'KeyZ']);
      expect(sorted(ig.padButtons)).toEqual([0, 5]);
      expect(sorted(ig.padDirs)).toEqual(['down']);
    }
  });
});

describe('gateFrame (受け入れ条件 6)', () => {
  const idle = (frameEnd: number, over: Partial<{ capturing: boolean; onGameScreen: boolean }> = {}) => ({
    capturing: false,
    onGameScreen: true,
    frameEnd,
    ...over,
  });

  it('初期値は capturePending=false・taintSince=null', () => {
    expect(INITIAL_GATE).toEqual({ capturePending: false, taintSince: null });
  });

  it('何もなければ block しない', () => {
    const r = gateFrame(INITIAL_GATE, idle(10));
    expect(r.block).toBe(false);
    expect(r.state).toEqual({ capturePending: false, taintSince: null });
  });

  it('捕まえ中のフレームは block し、capturePending が立つ', () => {
    const r = gateFrame(INITIAL_GATE, idle(10, { capturing: true }));
    expect(r.block).toBe(true);
    expect(r.state.capturePending).toBe(true);
  });

  it('捕まえが終わったのを見つけたフレームは block、その次のフレームは block しない', () => {
    let s = gateFrame(INITIAL_GATE, idle(10, { capturing: true })).state;
    const end = gateFrame(s, idle(20));
    expect(end.block).toBe(true);
    expect(end.state.capturePending).toBe(false);
    s = end.state;
    expect(gateFrame(s, idle(30)).block).toBe(false);
  });

  it('捕まえ中が続く間は block し続ける', () => {
    let s: GateState = INITIAL_GATE;
    for (let t = 0; t < 5; t++) {
      const r = gateFrame(s, idle(t, { capturing: true }));
      expect(r.block).toBe(true);
      s = r.state;
    }
  });

  it('game の画面でなければ、いつも block', () => {
    expect(gateFrame(INITIAL_GATE, idle(10, { onGameScreen: false })).block).toBe(true);
    const taint = gateEnterGame(INITIAL_GATE, 5);
    expect(gateFrame(taint, idle(10, { onGameScreen: false })).block).toBe(true);
  });

  it('画面を離れても capturePending・taintSince は壊れず、戻れば通常に戻る', () => {
    const r = gateFrame(INITIAL_GATE, idle(10, { onGameScreen: false }));
    expect(r.state).toEqual({ capturePending: false, taintSince: null });
    expect(gateFrame(r.state, idle(20)).block).toBe(false);
  });
});

describe('gateEnterGame (受け入れ条件 6)', () => {
  it('taintSince に時刻を入れ、capturePending は変えない', () => {
    expect(gateEnterGame(INITIAL_GATE, 100)).toEqual({ capturePending: false, taintSince: 100 });
    expect(gateEnterGame({ capturePending: true, taintSince: null }, 100)).toEqual({
      capturePending: true,
      taintSince: 100,
    });
  });

  it('引数の state を書き換えない', () => {
    const s: GateState = { capturePending: false, taintSince: null };
    gateEnterGame(s, 5);
    expect(s).toEqual({ capturePending: false, taintSince: null });
  });

  it('game に入った時刻 t のあと、frameEnd ≤ t のフレームは block のまま、frameEnd > t のフレームを 1 つ処理したら、その次から block しない', () => {
    let s = gateEnterGame(INITIAL_GATE, 100);
    const before = gateFrame(s, { capturing: false, onGameScreen: true, frameEnd: 90 });
    expect(before.block).toBe(true);
    s = before.state;
    const same = gateFrame(s, { capturing: false, onGameScreen: true, frameEnd: 100 });
    expect(same.block).toBe(true);
    s = same.state;
    expect(s.taintSince).toBe(100);
    const after = gateFrame(s, { capturing: false, onGameScreen: true, frameEnd: 101 });
    expect(after.block).toBe(true);
    expect(after.state.taintSince).toBeNull();
    expect(gateFrame(after.state, { capturing: false, onGameScreen: true, frameEnd: 120 }).block).toBe(false);
  });

  it('捕まえ中のフレームでは taintSince は外れない', () => {
    const s = gateEnterGame(INITIAL_GATE, 100);
    const r = gateFrame(s, { capturing: true, onGameScreen: true, frameEnd: 200 });
    expect(r.block).toBe(true);
    expect(r.state.taintSince).toBe(100);
  });

  it('例: rAF が 0・16.67・33.33ms、フレームの終わりが 2ms 手前。1ms に捕まえが終わったら、14.67 のフレームだけ block、31.33 は block しない', () => {
    // 0ms のフレームで捕まえ中。1ms に捕まえが終わり、game に入る
    let s = gateFrame(INITIAL_GATE, { capturing: true, onGameScreen: false, frameEnd: -2 }).state;
    s = gateEnterGame(s, 1);
    const f1 = gateFrame(s, { capturing: false, onGameScreen: true, frameEnd: 14.67 });
    expect(f1.block).toBe(true);
    const f2 = gateFrame(f1.state, { capturing: false, onGameScreen: true, frameEnd: 31.33 });
    expect(f2.block).toBe(false);
  });
});

describe('gateSawCapturing (受け入れ条件 6)', () => {
  it('そのあと、捕まえ中でないフレームは block（終わったのを見つけたフレーム扱い）。その次は block しない', () => {
    const s = gateSawCapturing(INITIAL_GATE);
    const r = gateFrame(s, { capturing: false, onGameScreen: true, frameEnd: 10 });
    expect(r.block).toBe(true);
    expect(gateFrame(r.state, { capturing: false, onGameScreen: true, frameEnd: 20 }).block).toBe(false);
  });

  it('taintSince は変えない。引数も書き換えない', () => {
    const s: GateState = { capturePending: false, taintSince: 7 };
    expect(gateSawCapturing(s).taintSince).toBe(7);
    expect(s).toEqual({ capturePending: false, taintSince: 7 });
  });
});
