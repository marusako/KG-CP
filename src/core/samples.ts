import { parseRecipe } from './combo';
import type { ComboRecipe } from './combo';
import { GG_RULES, SF6_RULES } from './commands';
import type { NotationRules } from './notation';

// 窓の数値は練習用の架空の値で、特定のゲームの数値ではない。
const SF6_JSON = [
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

const GG_JSON = [
  {
    id: 'gg-sample-1',
    name: '2K から 2D、236S（サンプル）',
    steps: [{ input: '2K' }, { input: '2D', window: [8, 14] }, { input: '236S', window: [0, 10] }],
  },
  {
    id: 'gg-sample-2',
    name: '5P 2回から 623HS（サンプル）',
    steps: [{ input: '5P' }, { input: '5P', window: [9, 13] }, { input: '623HS', window: [0, 10] }],
  },
  {
    id: 'gg-sample-3',
    name: '6P から 632146HS（サンプル）',
    steps: [{ input: '6P' }, { input: '632146HS', window: [4, 14] }],
  },
];

function build(json: readonly { id: string }[], rules: NotationRules): ComboRecipe[] {
  return json.map((j) => {
    const r = parseRecipe(j, rules);
    if (!r.ok) throw new Error(`サンプル ${j.id} が読めません: ${r.error}`);
    return r.recipe;
  });
}

export const SF6_SAMPLES: ComboRecipe[] = build(SF6_JSON, SF6_RULES);
export const GG_SAMPLES: ComboRecipe[] = build(GG_JSON, GG_RULES);
