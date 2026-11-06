// 第19段階 受け入れ条件 1: noDataMove（コマンドは成立したのに、フレームデータに当たる技がない技）。
// 本物のデータ（fighterDataFor・CHARACTERS）と入力の履歴で確かめる。
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/core/characters';
import { GG_RULES, SF6_RULES } from '../src/core/commands';
import { noDataMove } from '../src/core/fighter';
import { fighterDataFor } from '../src/core/frameData';
import type { Direction, FrameInput } from '../src/core/types';

type Spec = Direction | [Direction, string[]];
const frames = (...specs: Spec[]): FrameInput[] =>
  specs.map((s) => (Array.isArray(s) ? { dir: s[0], buttons: s[1] } : { dir: s, buttons: [] }));

const bridget = { data: fighterDataFor('bridget')!, character: CHARACTERS.find((c) => c.id === 'bridget')! };
const cammy = { data: fighterDataFor('cammy')!, character: CHARACTERS.find((c) => c.id === 'cammy')! };
const noB = (h: FrameInput[]) => noDataMove(h, bridget.data, bridget.character, GG_RULES)?.id ?? null;
const noC = (h: FrameInput[]) => noDataMove(h, cammy.data, cammy.character, SF6_RULES)?.id ?? null;

describe('noDataMove (第19段階 受け入れ条件 1)', () => {
  it('ブリジット 632146 + HS → 帰ってきたキルマシーン', () => {
    expect(noB(frames(5, 6, 3, 2, 1, 4, [6, ['HS']]))).toBe('bridget-killing-machine');
  });

  it('ブリジット 214 + S → ストップ＆ダッシュ（214版）', () => {
    expect(noB(frames(5, 2, 1, [4, ['S']]))).toBe('bridget-stop-and-dash-return');
  });

  it('ブリジット 214 + K → ローリング移動', () => {
    expect(noB(frames(5, 2, 1, [4, ['K']]))).toBe('bridget-rolling-movement');
  });

  it('ブリジット 236 + K（データがある）・5 + P（通常技）・ボタンなしのフレームは null', () => {
    expect(noB(frames(5, 2, 3, [6, ['K']]))).toBeNull();
    expect(noB(frames(5, [5, ['P']]))).toBeNull();
    expect(noB(frames(5, 2, 1, 4))).toBeNull();
    expect(noB(frames(5, 5))).toBeNull();
  });

  it('ボタンが新しく押されたフレームだけ（押しっぱなしの次のフレームは null）', () => {
    expect(noB(frames(5, 2, 1, [4, ['S']], [4, ['S']]))).toBeNull();
  });

  it('キャミィ 214 + K → キャノンストライク（Cannon Strike）', () => {
    const m = noDataMove(frames(5, 2, 1, [4, ['LK']]), cammy.data, cammy.character, SF6_RULES);
    expect(m?.id).toBe('cammy-cannon-strike');
    expect(m?.name.en).toBe('Cannon Strike');
  });

  it('キャミィ 236 + LP（フーリガン。第17段階でデータがある）は null', () => {
    expect(noC(frames(5, 2, 3, [6, ['LP']]))).toBeNull();
  });

  it('キャミィ 5 + LP・236 + K（データがある）は null', () => {
    expect(noC(frames(5, [5, ['LP']]))).toBeNull();
    expect(noC(frames(5, 2, 3, [6, ['LK']]))).toBeNull();
  });
});
