import { afterEach, describe, expect, it } from 'vitest';
import {
  INITIAL_METER,
  METER_LENGTH,
  meterCells,
  meterRuns,
  setMeterMode,
  stepMeter,
} from '../src/core/inputMeter';
import type { MeterCell, MeterState } from '../src/core/inputMeter';
import type { Direction, FrameInput } from '../src/core/types';
import { setLang } from '../src/i18n/lang';
import { msg } from '../src/i18n/messages';

const f = (dir: Direction, ...buttons: string[]): FrameInput => ({ dir, buttons });
const cell = (dir: Direction, pressed: string[] = [], held: string[] = pressed): MeterCell => ({
  dir,
  pressed,
  held,
});

afterEach(() => {
  setLang('ja');
});

describe('METER_LENGTH / INITIAL_METER', () => {
  it('METER_LENGTH は 60', () => {
    expect(METER_LENGTH).toBe(60);
  });
  it('初期状態は freeze で空', () => {
    expect(INITIAL_METER).toEqual({ mode: 'freeze', cells: [] });
  });
});

describe('meterCells (第9段階 受け入れ条件 1)', () => {
  it('空の history は空配列', () => {
    expect(meterCells([], 5)).toEqual([]);
  });

  it('最後の length フレームだけを古い順に返す', () => {
    const h = [f(1), f(2), f(3), f(4), f(6)];
    expect(meterCells(h, 3).map((c) => c.dir)).toEqual([3, 4, 6]);
  });

  it('history が length より短ければ、ある分だけ返す', () => {
    expect(meterCells([f(2), f(3)], 10).map((c) => c.dir)).toEqual([2, 3]);
  });

  it('length を省略すると METER_LENGTH 分', () => {
    const h = Array.from({ length: 80 }, () => f(5));
    expect(meterCells(h)).toHaveLength(METER_LENGTH);
  });

  it('held は、そのフレームで押されているボタン', () => {
    const cells = meterCells([f(5), f(5, 'P', 'K')], 5);
    expect(cells[0]!.held).toEqual([]);
    expect([...cells[1]!.held].sort()).toEqual(['K', 'P']);
  });

  it('押し始めのフレームだけ pressed、押しっぱなしの続きは pressed にならない', () => {
    const cells = meterCells([f(5), f(5, 'P'), f(5, 'P'), f(5)], 10);
    expect(cells.map((c) => [...c.pressed])).toEqual([[], ['P'], [], []]);
    expect(cells.map((c) => [...c.held])).toEqual([[], ['P'], ['P'], []]);
  });

  it('離して押し直したら、もう一度 pressed', () => {
    const cells = meterCells([f(5, 'P'), f(5), f(5, 'P')], 10);
    expect(cells.map((c) => [...c.pressed])).toEqual([['P'], [], ['P']]);
  });

  it('範囲の先頭で押しっぱなしのボタンは pressed にならない（1 つ前のフレームも見る）', () => {
    const h = [f(5, 'P'), f(5, 'P'), f(5, 'P')];
    const cells = meterCells(h, 2);
    expect(cells).toHaveLength(2);
    expect(cells[0]!.pressed).toEqual([]);
    expect(cells[0]!.held).toEqual(['P']);
  });

  it('範囲の先頭のフレームで押し始めたボタンは、1 つ前で押されていなければ pressed', () => {
    const h = [f(5), f(5, 'P'), f(5, 'P')];
    const cells = meterCells(h, 2);
    expect(cells[0]!.pressed).toEqual(['P']);
    expect(cells[1]!.pressed).toEqual([]);
  });

  it('範囲の先頭で、1 つ前では別のボタンだけ押されていた場合は新しいボタンだけ pressed', () => {
    const h = [f(5, 'K'), f(5, 'K', 'P')];
    const cells = meterCells(h, 1);
    expect(cells[0]!.pressed).toEqual(['P']);
  });

  it('history の 1 つ目のフレームで押されているボタンは pressed', () => {
    const cells = meterCells([f(6, 'P'), f(6, 'P')], 10);
    expect(cells[0]!.pressed).toEqual(['P']);
    expect(cells[1]!.pressed).toEqual([]);
  });

  it('history の 1 つ目のフレームで length=1 のときも pressed', () => {
    const cells = meterCells([f(6, 'K')], 1);
    expect(cells[0]!.pressed).toEqual(['K']);
  });
});

describe('meterRuns (第9段階 受け入れ条件 2)', () => {
  it('空なら空', () => {
    expect(meterRuns([])).toEqual([]);
  });

  it('例: 2,2,2,3,6,6+P → 2(3F)・3(1F)・6(2F, P)', () => {
    const cells = meterCells([f(2), f(2), f(2), f(3), f(6), f(6, 'P')], 60);
    expect(meterRuns(cells)).toEqual([
      { dir: 2, frames: 3, pressed: [] },
      { dir: 3, frames: 1, pressed: [] },
      { dir: 6, frames: 2, pressed: ['P'] },
    ]);
  });

  it('ボタンが押されても区間は切れない', () => {
    const runs = meterRuns([cell(6), cell(6, ['P']), cell(6)]);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual({ dir: 6, frames: 3, pressed: ['P'] });
  });

  it('同じ区間で 2 回押されたボタンは 1 つにまとめる', () => {
    const runs = meterRuns([cell(5, ['P']), cell(5, [], []), cell(5, ['P'])]);
    expect(runs).toEqual([{ dir: 5, frames: 3, pressed: ['P'] }]);
  });

  it('複数ボタンは押された順', () => {
    const runs = meterRuns([cell(5, ['K']), cell(5, ['P'], ['K', 'P'])]);
    expect(runs[0]!.pressed).toEqual(['K', 'P']);
  });

  it('離れた同じ方向は別々の区間', () => {
    const runs = meterRuns([cell(2), cell(5), cell(2)]);
    expect(runs.map((r) => [r.dir, r.frames])).toEqual([
      [2, 1],
      [5, 1],
      [2, 1],
    ]);
  });
});

describe('stepMeter / setMeterMode (第9段階 受け入れ条件 3)', () => {
  it('live: いつも最新の length フレーム', () => {
    let s: MeterState = setMeterMode(INITIAL_METER, 'live');
    const h: FrameInput[] = [];
    for (const d of [2, 2, 3, 6] as Direction[]) {
      h.push(f(d));
      s = stepMeter(s, h, 3);
      expect(s.cells).toEqual(meterCells(h, 3));
    }
    expect(s.mode).toBe('live');
    expect(s.cells.map((c) => c.dir)).toEqual([2, 3, 6]);
  });

  it('freeze: ボタンが押されていないあいだは前のまま（空のまま）', () => {
    let s = INITIAL_METER;
    const h: FrameInput[] = [];
    for (const d of [2, 3, 6] as Direction[]) {
      h.push(f(d));
      s = stepMeter(s, h, 10);
    }
    expect(s.cells).toEqual([]);
    expect(s.mode).toBe('freeze');
  });

  it('freeze: ボタンが新しく押されたフレームで最新の length フレームに入れ替わる', () => {
    let s = INITIAL_METER;
    const h = [f(2), f(3), f(6)];
    for (let i = 1; i <= h.length; i++) s = stepMeter(s, h.slice(0, i), 10);
    h.push(f(6, 'P'));
    s = stepMeter(s, h, 10);
    expect(s.cells).toEqual(meterCells(h, 10));
    expect(s.cells[s.cells.length - 1]!.pressed).toEqual(['P']);
  });

  it('freeze: 押しっぱなしでは入れ替わらない', () => {
    const h = [f(2), f(6, 'P')];
    let s = stepMeter(INITIAL_METER, h, 10);
    const frozen = s.cells;
    h.push(f(6, 'P'), f(3, 'P'));
    s = stepMeter(s, h.slice(0, 3), 10);
    expect(s.cells).toEqual(frozen);
    s = stepMeter(s, h, 10);
    expect(s.cells).toEqual(frozen);
  });

  it('freeze: ボタンを離したあとも前のまま、押し直すと入れ替わる', () => {
    const h = [f(2), f(6, 'P')];
    let s = stepMeter(INITIAL_METER, h, 10);
    const frozen = s.cells;
    h.push(f(6));
    s = stepMeter(s, h, 10);
    expect(s.cells).toEqual(frozen);
    h.push(f(6, 'P'));
    s = stepMeter(s, h, 10);
    expect(s.cells).toEqual(meterCells(h, 10));
    expect(s.cells).not.toEqual(frozen);
  });

  it('freeze: history の 1 フレーム目でボタンが押されていれば入れ替わる', () => {
    const h = [f(5, 'P')];
    const s = stepMeter(INITIAL_METER, h, 10);
    expect(s.cells).toEqual(meterCells(h, 10));
    expect(s.cells).toHaveLength(1);
  });

  it('freeze: 別のボタンが追加で新しく押されたら入れ替わる', () => {
    const h = [f(5, 'P')];
    let s = stepMeter(INITIAL_METER, h, 10);
    h.push(f(5, 'P', 'K'));
    s = stepMeter(s, h, 10);
    expect(s.cells).toHaveLength(2);
  });

  it('setMeterMode は mode だけ変えて cells はそのまま', () => {
    const s = stepMeter(INITIAL_METER, [f(2), f(6, 'P')], 10);
    const live = setMeterMode(s, 'live');
    expect(live.mode).toBe('live');
    expect(live.cells).toEqual(s.cells);
    const back = setMeterMode(live, 'freeze');
    expect(back.mode).toBe('freeze');
    expect(back.cells).toEqual(s.cells);
  });
});

describe('meterRunsText (第9段階 受け入れ条件 4)', () => {
  const runs = [
    { dir: 2 as Direction, frames: 3, pressed: [] as string[] },
    { dir: 3 as Direction, frames: 1, pressed: [] as string[] },
    { dir: 6 as Direction, frames: 2, pressed: ['P'] },
  ];
  const expected = '2 (3F) → 3 (1F) → 6 (2F) + P';

  it('日本語: 例のとおりの文', () => {
    setLang('ja');
    expect(msg().meterRunsText(runs)).toBe(expected);
  });

  it('英語: 日本語と同じ文', () => {
    setLang('en');
    expect(msg().meterRunsText(runs)).toBe(expected);
  });

  it('複数ボタンは + P + K', () => {
    for (const l of ['ja', 'en'] as const) {
      setLang(l);
      expect(msg().meterRunsText([{ dir: 5, frames: 4, pressed: ['P', 'K'] }])).toBe(
        '5 (4F) + P + K',
      );
    }
  });

  it('空なら空文字', () => {
    expect(msg().meterRunsText([])).toBe('');
  });
});

describe('stepMeter: 変わらないときは同じものを返す（第9段階 レビューの提案 A）', () => {
  // main.ts は「前と同じものなら描き直さない」で毎フレームの処理を減らしているので、それを守る
  it('freeze で新しく押していないフレームは、同じ state をそのまま返す', () => {
    const h: FrameInput[] = [{ dir: 2, buttons: ['P'] }];
    const s1 = stepMeter(INITIAL_METER, h);
    h.push({ dir: 3, buttons: ['P'] }); // 押しっぱなし
    expect(stepMeter(s1, h)).toBe(s1);
    h.push({ dir: 6, buttons: [] }); // 離した
    expect(stepMeter(s1, h)).toBe(s1);
  });

  it('freeze で押していないときは、空の history でも同じ state を返す', () => {
    expect(stepMeter(INITIAL_METER, [])).toBe(INITIAL_METER);
  });
});
