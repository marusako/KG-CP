import { describe, expect, it } from 'vitest';
import { compressHistory } from '../src/core/history';
import type { Direction, FrameInput } from '../src/core/types';

const f = (dir: Direction, ...buttons: string[]): FrameInput => ({ dir, buttons });

describe('compressHistory (受け入れ条件 4)', () => {
  it('空の履歴は空配列', () => {
    expect(compressHistory([], 10)).toEqual([]);
  });

  it('同じ状態が続けば 1 つにまとめて frames を数える', () => {
    expect(compressHistory([f(6), f(6), f(6)], 10)).toEqual([
      { dir: 6, buttons: [], pressed: [], frames: 3 },
    ]);
  });

  it('新しい順に返す', () => {
    const r = compressHistory([f(2), f(2), f(3), f(6), f(6), f(6)], 10);
    expect(r.map((e) => [e.dir, e.frames])).toEqual([
      [6, 3],
      [3, 1],
      [2, 2],
    ]);
  });

  it('離れた同じ状態は別々の項目のまま', () => {
    const r = compressHistory([f(2), f(5), f(2)], 10);
    expect(r.map((e) => e.dir)).toEqual([2, 5, 2]);
  });

  it('区間の先頭フレームで押された瞬間のボタンが pressed に入る', () => {
    const r = compressHistory([f(5), f(5, 'LP'), f(5, 'LP'), f(5)], 10);
    expect(r).toEqual([
      { dir: 5, buttons: [], pressed: [], frames: 1 },
      { dir: 5, buttons: ['LP'], pressed: ['LP'], frames: 2 },
      { dir: 5, buttons: [], pressed: [], frames: 1 },
    ]);
  });

  it('先頭フレームにボタンがあれば (前フレームなし) 押された瞬間として pressed に入る', () => {
    const r = compressHistory([f(5, 'LP')], 10);
    expect(r).toEqual([{ dir: 5, buttons: ['LP'], pressed: ['LP'], frames: 1 }]);
  });

  it('押しっぱなしのまま方向が変わった区間の pressed は空', () => {
    const r = compressHistory([f(2, 'LP'), f(3, 'LP')], 10);
    expect(r[0]).toMatchObject({ dir: 3, pressed: [], frames: 1 });
    expect(r[1]).toMatchObject({ dir: 2, pressed: ['LP'], frames: 1 });
  });

  it('ボタンが増えた区間では、新しく押されたボタンだけが pressed に入る', () => {
    const r = compressHistory([f(5, 'LP'), f(5, 'LP', 'MP')], 10);
    expect(r[0]).toMatchObject({ dir: 5, pressed: ['MP'], frames: 1 });
    expect(r[0]!.buttons).toHaveLength(2);
  });

  it('ボタンの順番が違うだけなら同じ状態としてまとめる', () => {
    const r = compressHistory([f(5, 'LP', 'MP'), f(5, 'MP', 'LP')], 10);
    expect(r).toHaveLength(1);
    expect(r[0]!.frames).toBe(2);
    expect([...r[0]!.buttons].sort()).toEqual(['LP', 'MP']);
  });

  it('maxEntries 件まで、新しい方から返す', () => {
    const h = [f(1), f(2), f(3), f(4), f(6)];
    const r = compressHistory(h, 2);
    expect(r.map((e) => e.dir)).toEqual([6, 4]);
  });

  it('maxEntries が項目数以上なら全件返す', () => {
    const r = compressHistory([f(1), f(2)], 5);
    expect(r.map((e) => e.dir)).toEqual([2, 1]);
  });
});
