import { parseRecipe } from './combo';
import type { ComboRecipe } from './combo';
import { DEFAULT_COMMANDS } from './commands';

// 窓の数値は練習用の架空の値で、特定のゲームの数値ではない。
const SAMPLE_JSON = [
  {
    id: 'sample-1',
    name: '小足2回から波動（サンプル）',
    steps: [{ input: '2LP' }, { input: '2LP', window: [10, 14] }, { input: '236HP', window: [0, 10] }],
  },
  {
    id: 'sample-2',
    name: '立ち中P から昇龍（サンプル）',
    steps: [{ input: '5MP' }, { input: '623HP', window: [4, 12] }],
  },
  {
    id: 'sample-3',
    name: '小足から溜め技（サンプル）',
    steps: [{ input: '2LK' }, { input: '2LK', window: [8, 12] }, { input: '[4]6P', window: [0, 8] }],
  },
];

export const SAMPLE_RECIPES: ComboRecipe[] = SAMPLE_JSON.map((json) => {
  const r = parseRecipe(json, DEFAULT_COMMANDS);
  if (!r.ok) throw new Error(`サンプル ${json.id} が読めません: ${r.error}`);
  return r.recipe;
});
