import { describe, expect, it } from 'vitest';
import { GG_SAMPLES, SF6_SAMPLES } from '../src/core/samples';
import { parseRecipe } from '../src/core/combo';
import type { ComboRecipe } from '../src/core/combo';
import { PROFILES } from '../src/core/profiles';

const suites: [string, readonly ComboRecipe[], typeof PROFILES.sf6][] = [
  ['SF6_SAMPLES', SF6_SAMPLES, PROFILES.sf6],
  ['GG_SAMPLES', GG_SAMPLES, PROFILES.ggst],
];

for (const [label, samples, profile] of suites) {
  describe(`${label} (受け入れ条件 2・6)`, () => {
    it('1つ以上あり、id が重複しない', () => {
      expect(samples.length).toBeGreaterThanOrEqual(1);
      const ids = samples.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('名前に「（サンプル）」が付いている', () => {
      for (const r of samples) expect(r.name).toContain('（サンプル）');
    });

    it('すべて、書き出した JSON を parseRecipe が読める（元の表記と窓が保たれる）', () => {
      for (const r of samples) {
        const json = {
          id: r.id,
          name: r.name,
          steps: r.steps.map((s, i) =>
            i === 0 || !s.window ? { input: s.text } : { input: s.text, window: [s.window.min, s.window.max] },
          ),
        };
        const parsed = parseRecipe(json, profile);
        if (!parsed.ok) throw new Error(`${r.id}: ${parsed.error}`);
        expect(parsed.recipe.steps.map((s) => s.text)).toEqual(r.steps.map((s) => s.text));
        expect(parsed.recipe.steps.map((s) => s.window)).toEqual(r.steps.map((s) => s.window));
      }
    });

    it('最初の手の window は null、2手目以降は window がある', () => {
      for (const r of samples) {
        r.steps.forEach((s, i) => {
          if (i === 0) expect(s.window).toBeNull();
          else expect(s.window).not.toBeNull();
        });
      }
    });
  });
}

describe('SF6_SAMPLES の中身は今と同じ (受け入れ条件 2)', () => {
  const shape = (r: ComboRecipe) => ({ id: r.id, name: r.name, steps: r.steps.map((s) => [s.text, s.window]) });

  it('3 つの id・名前・手・窓', () => {
    expect(SF6_SAMPLES.map(shape)).toEqual([
      {
        id: 'sample-1',
        name: '小足2回から波動（サンプル）',
        steps: [['2LP', null], ['2LP', { min: 10, max: 14 }], ['236HP', { min: 0, max: 10 }]],
      },
      {
        id: 'sample-2',
        name: '立ち中P から昇龍（サンプル）',
        steps: [['5MP', null], ['623HP', { min: 4, max: 12 }]],
      },
      {
        id: 'sample-3',
        name: '小足から溜め技（サンプル）',
        steps: [['2LK', null], ['2LK', { min: 8, max: 12 }], ['[4]6P', { min: 0, max: 8 }]],
      },
    ]);
  });
});

describe('GG_SAMPLES の中身 (受け入れ条件 2)', () => {
  const shape = (r: ComboRecipe) => ({ id: r.id, name: r.name, steps: r.steps.map((s) => [s.text, s.window]) });

  it('3 つの id・名前・手・窓がプランのとおり', () => {
    expect(GG_SAMPLES.map(shape)).toEqual([
      {
        id: 'gg-sample-1',
        name: '2K から 2D、236S（サンプル）',
        steps: [['2K', null], ['2D', { min: 8, max: 14 }], ['236S', { min: 0, max: 10 }]],
      },
      {
        id: 'gg-sample-2',
        name: '5P 2回から 623HS（サンプル）',
        steps: [['5P', null], ['5P', { min: 9, max: 13 }], ['623HS', { min: 0, max: 10 }]],
      },
      {
        id: 'gg-sample-3',
        name: '6P から 632146HS（サンプル）',
        steps: [['6P', null], ['632146HS', { min: 4, max: 14 }]],
      },
    ]);
  });

  it('GG のルールで、各手の入力が読める（HS は HS のまま）', () => {
    const last = GG_SAMPLES[1]!.steps[2]!.input;
    expect(last.kind).toBe('command');
    expect(last.buttons).toEqual(['HS']);
    const d = GG_SAMPLES[0]!.steps[1]!.input;
    expect(d.kind).toBe('normal');
    if (d.kind === 'normal') expect([...d.dirs].sort()).toEqual([1, 2, 3]);
    expect(d.buttons).toEqual(['D']);
  });
});
