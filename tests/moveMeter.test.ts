import { describe, expect, it } from 'vitest';
import { fighterDataFor } from '../src/core/frameData';
import type { MoveFrames } from '../src/core/frameData';
import { INITIAL_FIGHTER, stepFighter } from '../src/core/fighter';
import type { FighterPhase, FighterState } from '../src/core/fighter';
import { meterKindOf, stepMoveMeter } from '../src/core/moveMeter';
import type { MoveMeterKind, MoveMeterState } from '../src/core/moveMeter';
import { CHARACTERS } from '../src/core/characters';
import { PROFILES } from '../src/core/profiles';
import { msg } from '../src/i18n/messages';
import type { FrameInput } from '../src/core/types';

const cammyData = fighterDataFor('cammy')!;
const cammyChar = CHARACTERS.find((c) => c.id === 'cammy')!;
const cammy = { data: cammyData, character: cammyChar };
const lp = cammyData.moves.find((m) => m.input === '5LP')!;
const mk = (input: string): MoveFrames => cammyData.moves.find((m) => m.input === input)!;

const at = (phase: FighterPhase, frame = 0, move: MoveFrames | null = null): FighterState => ({
  ...INITIAL_FIGHTER,
  phase,
  frame,
  move,
});

const EMPTY: MoveMeterState = { cells: [], frozen: false };
const neutral: FrameInput = { dir: 5, buttons: [] };
const press: FrameInput = { dir: 5, buttons: ['LP'] };

/** 入力を 1 フレームずつ流して、技のメーターを最後まで進める */
function run(inputs: FrameInput[], meter: MoveMeterState = EMPTY) {
  let fighter = INITIAL_FIGHTER;
  let m = meter;
  const metersByFrame: MoveMeterState[] = [];
  const history: FrameInput[] = [];
  for (const f of inputs) {
    history.push(f);
    const next = stepFighter(fighter, history, cammy, PROFILES.sf6, PROFILES.sf6.inputBuffer);
    m = stepMoveMeter(m, fighter, next);
    metersByFrame.push(m);
    fighter = next;
  }
  return metersByFrame;
}
const rep = (n: number, f: FrameInput): FrameInput[] => Array.from({ length: n }, () => f);
const times = (n: number, k: MoveMeterKind): MoveMeterKind[] => Array.from({ length: n }, () => k);

describe('meterKindOf (第10段階 受け入れ条件 5)', () => {
  const table: [FighterPhase, MoveMeterKind][] = [
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
      expect(meterKindOf(at(phase, 0, kind === 'free' || kind === 'jump' ? null : lp))).toBe(kind);
    });
  }
});

describe('stepMoveMeter (第10段階 受け入れ条件 5)', () => {
  it('技を出していない間は、同じ state（同じ参照）を返す', () => {
    expect(stepMoveMeter(EMPTY, at('idle'), at('idle'))).toBe(EMPTY);
    expect(stepMoveMeter(EMPTY, at('idle'), at('walkForward'))).toBe(EMPTY);
    const frozen: MoveMeterState = { cells: ['startup', 'active'], frozen: true };
    expect(stepMoveMeter(frozen, at('idle'), at('crouch'))).toBe(frozen);
  });

  it('5LP を出すと、発生前 3・持続 3・硬直 7 の 13 マスが積まれ、終わると止まる', () => {
    const ms = run([press, ...rep(12, neutral)]);
    // 押したフレームから積み始め、積んでいる間は frozen でない
    expect(ms[0]!.cells[0]).toBe('startup');
    expect(ms[0]!.frozen).toBe(false);
    expect(ms[5]!.cells).toEqual([...times(3, 'startup'), ...times(3, 'active')]);
    expect(ms[12]!.cells).toEqual([...times(3, 'startup'), ...times(3, 'active'), ...times(7, 'recovery')]);
    expect(ms[12]!.frozen).toBe(false);
    // 13 フレーム目で idle に戻る。帯は残り、止まる
    const after = run([press, ...rep(13, neutral)]);
    expect(after[13]!.cells).toHaveLength(13);
    expect(after[13]!.cells).toEqual(ms[12]!.cells);
    expect(after[13]!.frozen).toBe(true);
  });

  it('止まったあとは、何フレーム経っても帯が残る', () => {
    const ms = run([press, ...rep(40, neutral)]);
    expect(ms[40]!.cells).toHaveLength(13);
    expect(ms[40]!.frozen).toBe(true);
    expect(ms[40]).toBe(ms[20]);
  });

  it('次の技を出し始めると、帯が空から積み直しになる', () => {
    const ms = run([press, ...rep(20, neutral), press]);
    expect(ms[20]!.frozen).toBe(true);
    expect(ms[21]!.cells).toEqual(['startup']);
    expect(ms[21]!.frozen).toBe(false);
  });

  it('技が終わる瞬間に先行入力で次の技が始まるときも、新しい帯になる', () => {
    const next = stepMoveMeter(
      { cells: times(13, 'recovery'), frozen: false },
      at('recovery', 6, lp),
      at('startup', 0, lp),
    );
    expect(next.cells).toEqual(['startup']);
    expect(next.frozen).toBe(false);
  });

  it('120 マスを超えたら、古いほうを捨てる', () => {
    const full: MoveMeterState = { cells: times(120, 'startup'), frozen: false };
    const next = stepMoveMeter(full, at('startup', 2, lp), at('active', 0, lp));
    expect(next.cells).toHaveLength(120);
    expect(next.cells[119]).toBe('active');
    expect(next.cells[0]).toBe('startup');
    expect(next.cells.filter((c) => c === 'startup')).toHaveLength(119);
  });
});

describe('moveMeterText (第10段階 受け入れ条件 6。技名つきはユーザーの要望で追加)', () => {
  it('日本語: 技名 (入力) — 発生 4F / 持続 3F / 硬直 7F / 全体 13F（発生は発生前 + 1）', () => {
    expect(msg('ja').moveMeterText('立ち弱P (5LP)', lp)).toBe('立ち弱P (5LP) — 発生 4F / 持続 3F / 硬直 7F / 全体 13F');
  });

  it('英語: Standing LP (5LP) — Startup 4F / Active 3F / Recovery 7F / Total 13F', () => {
    expect(msg('en').moveMeterText('Standing LP (5LP)', lp)).toBe(
      'Standing LP (5LP) — Startup 4F / Active 3F / Recovery 7F / Total 13F',
    );
  });

  it('別の技（236HK）でも同じ形で、発生は 15、全体は 51', () => {
    expect(msg('ja').moveMeterText('X (236HK)', mk('236HK'))).toBe('X (236HK) — 発生 15F / 持続 16F / 硬直 21F / 全体 51F');
    expect(msg('en').moveMeterText('X (236HK)', mk('236HK'))).toBe(
      'X (236HK) — Startup 15F / Active 16F / Recovery 21F / Total 51F',
    );
  });
});
