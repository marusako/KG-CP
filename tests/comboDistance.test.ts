// 第20段階（レビューの要修正 1）: コンボのタブの距離を、recipeDistance で「次に押す S がどの手のためか」から決める。
import { describe, expect, it } from 'vitest';
import { CHARACTERS, comboToRecipe } from '../src/core/characters';
import { parseRecipe } from '../src/core/combo';
import type { ComboRecipe } from '../src/core/combo';
import { initialSimTrial, resolveRecipe, stepSimTrial } from '../src/core/comboSim';
import type { SimFrame, SimTrialEvent } from '../src/core/comboSim';
import { recipeDistance } from '../src/core/comboDistance';
import { GG_RULES } from '../src/core/commands';
import { INITIAL_DUMMY, stepDummy } from '../src/core/dummy';
import type { DummyState } from '../src/core/dummy';
import { INITIAL_FIGHTER, stepFighter } from '../src/core/fighter';
import type { FighterState } from '../src/core/fighter';
import { fighterDataFor } from '../src/core/frameData';
import { PROFILES } from '../src/core/profiles';
import type { Direction, FrameInput } from '../src/core/types';

const bridget = {
  data: fighterDataFor('bridget')!,
  character: CHARACTERS.find((c) => c.id === 'bridget')!,
};
const N: FrameInput = { dir: 5, buttons: [] };
const b = (dir: Direction, ...buttons: string[]): FrameInput => ({ dir, buttons });
type Entries = [number, FrameInput][];
const c236 = (f: number, btn: string): Entries => [[f - 2, b(2)], [f - 1, b(3)], [f, b(6, btn)]];

const comboRecipe = (id: string): ComboRecipe => {
  const combo = bridget.character.combos.find((c) => c.id === id);
  if (!combo) throw new Error(`${id} がありません`);
  return comboToRecipe(combo, PROFILES.ggst)!;
};
const stepsOf = (r: ComboRecipe) => r.steps.map((s) => s.input);
const recipeOf = (texts: string[]): ComboRecipe => {
  const r = parseRecipe(
    { id: 'r', name: 'r', steps: texts.map((input, i) => (i === 0 ? { input } : { input, window: [0, 15] })) },
    GG_RULES,
  );
  if (!r.ok) throw new Error(r.error);
  return r.recipe;
};

describe('recipeDistance', () => {
  it('combo-3（c.S > f.S > 5HS > 236K）: 手 0 は close、手 1 は far、手 2・3 は前の値のまま', () => {
    const steps = stepsOf(comboRecipe('bridget-combo-3'));
    expect(recipeDistance(steps, 0, 'far')).toBe('close');
    expect(recipeDistance(steps, 1, 'close')).toBe('far');
    for (const prev of ['close', 'far'] as const) {
      expect(recipeDistance(steps, 2, prev)).toBe(prev);
      expect(recipeDistance(steps, 3, prev)).toBe(prev);
    }
  });

  it('combo-1（c.S > 2S > 2HS > 236K）: 手 0 は close、2S・2HS・236K は前の値のまま', () => {
    const steps = stepsOf(comboRecipe('bridget-combo-1'));
    expect(recipeDistance(steps, 0, 'far')).toBe('close');
    for (const next of [1, 2, 3]) {
      for (const prev of ['close', 'far'] as const) expect(recipeDistance(steps, next, prev), `next=${next}`).toBe(prev);
    }
  });

  it('手 0 は、レシピの最初の c.S・f.S の手に合わせる（2S から始まり f.S があれば far）。c.S・f.S がなければ close', () => {
    expect(recipeDistance(stepsOf(recipeOf(['2S', 'f.S'])), 0, 'close')).toBe('far');
    expect(recipeDistance(stepsOf(recipeOf(['2S', 'c.S', 'f.S'])), 0, 'far')).toBe('close');
    expect(recipeDistance(stepsOf(recipeOf(['5P', '2P'])), 0, 'far')).toBe('close');
  });

  it('range なしの 5S の手は、それ以外として前の値のまま', () => {
    const steps = stepsOf(recipeOf(['c.S', '5S']));
    expect(recipeDistance(steps, 1, 'far')).toBe('far');
    expect(recipeDistance(steps, 1, 'close')).toBe('close');
  });
});

describe('combo-3: 2 手目の S を c.S の発生中（4）に押す', () => {
  it('距離を「今の技が待っている手の技なら next = stepIndex + 1、そうでなければ stepIndex」で決めて渡すと、21 から f.S が出て完走する', () => {
    const recipe = comboRecipe('bridget-combo-3');
    const moves = resolveRecipe(recipe, bridget.data, GG_RULES)!;
    const steps = stepsOf(recipe);
    const ORIGIN = 20;
    const entries: Entries = [[0, b(5, 'S')], [4, b(5, 'S')], [35, b(5, 'HS')], ...c236(60, 'K')];
    const inputs: FrameInput[] = Array.from({ length: ORIGIN + 130 }, () => N);
    for (const [f, input] of entries) inputs[ORIGIN + f] = input;

    let fighter: FighterState = INITIAL_FIGHTER;
    let dummy: DummyState = INITIAL_DUMMY;
    let state = initialSimTrial();
    let distance: 'close' | 'far' = recipeDistance(steps, 0, 'close');
    const history: FrameInput[] = [];
    const events: [number, SimTrialEvent][] = [];
    const contacts: number[] = [];
    const started: [number, string][] = [];
    inputs.forEach((input, i) => {
      history.push(input);
      // 押すフレームの前に、いまのキャラの技が待っている手の技なら次の手のため
      const waiting = moves[state.stepIndex]?.some((m) => m.input === fighter.move?.input) ?? false;
      distance = recipeDistance(steps, waiting ? state.stepIndex + 1 : state.stepIndex, distance);
      const stepped = stepFighter(fighter, history, bridget, PROFILES.ggst, 4, distance);
      const r = stepDummy(dummy, stepped, 'hit');
      const sim: SimFrame = { frame: i, before: fighter, after: r.fighter, dummyBefore: dummy, dummyAfter: r.dummy, contact: r.contact };
      const out = stepSimTrial(state, moves, sim, 4);
      state = out.state;
      if (out.event) events.push([i - ORIGIN, out.event]);
      if (r.contact) contacts.push(i - ORIGIN);
      if (r.fighter.move && r.fighter.phase === 'startup' && r.fighter.frame === 0) started.push([i - ORIGIN, r.fighter.move.input]);
      fighter = r.fighter;
      dummy = r.dummy;
    });
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
