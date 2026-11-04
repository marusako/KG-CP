import { describe, expect, it } from 'vitest';
import { SAMPLE_RECIPES } from '../src/core/samples';
import { parseRecipe } from '../src/core/combo';
import { DEFAULT_COMMANDS } from '../src/core/commands';

describe('SAMPLE_RECIPES (受け入れ条件 6)', () => {
  it('1つ以上あり、id が重複しない', () => {
    expect(SAMPLE_RECIPES.length).toBeGreaterThanOrEqual(1);
    const ids = SAMPLE_RECIPES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('名前に「（サンプル）」が付いている', () => {
    for (const r of SAMPLE_RECIPES) expect(r.name).toContain('（サンプル）');
  });

  it('すべて、書き出した JSON を parseRecipe が読める（元の表記と窓が保たれる）', () => {
    for (const r of SAMPLE_RECIPES) {
      const json = {
        id: r.id,
        name: r.name,
        steps: r.steps.map((s, i) =>
          i === 0 || !s.window ? { input: s.text } : { input: s.text, window: [s.window.min, s.window.max] },
        ),
      };
      const parsed = parseRecipe(json, DEFAULT_COMMANDS);
      if (!parsed.ok) throw new Error(`${r.id}: ${parsed.error}`);
      expect(parsed.recipe.steps.map((s) => s.text)).toEqual(r.steps.map((s) => s.text));
      expect(parsed.recipe.steps.map((s) => s.window)).toEqual(r.steps.map((s) => s.window));
    }
  });

  it('最初の手の window は null、2手目以降は window がある', () => {
    for (const r of SAMPLE_RECIPES) {
      r.steps.forEach((s, i) => {
        if (i === 0) expect(s.window).toBeNull();
        else expect(s.window).not.toBeNull();
      });
    }
  });
});
