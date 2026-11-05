import { msg } from '../i18n/messages';
import { parseRecipe } from './combo';
import type { ComboRecipe } from './combo';
import { GG_RULES, SF6_RULES } from './commands';
import type { NotationRules } from './notation';

// 窓の数値は練習用の架空の値で、特定のゲームの数値ではない。
const SF6_JSON: { id: SampleId; steps: unknown[] }[] = [
  {
    id: 'sample-1',
    steps: [{ input: '2LP' }, { input: '2LP', window: [10, 14] }, { input: '236HP', window: [0, 10] }],
  },
  {
    id: 'sample-2',
    steps: [{ input: '5MP' }, { input: '623HP', window: [4, 12] }],
  },
  {
    id: 'sample-3',
    steps: [{ input: '2LK' }, { input: '2LK', window: [8, 12] }, { input: '[4]6P', window: [0, 8] }],
  },
];

const GG_JSON: { id: SampleId; steps: unknown[] }[] = [
  {
    id: 'gg-sample-1',
    steps: [{ input: '2K' }, { input: '2D', window: [8, 14] }, { input: '236S', window: [0, 10] }],
  },
  {
    id: 'gg-sample-2',
    steps: [{ input: '5P' }, { input: '5P', window: [9, 13] }, { input: '623HS', window: [0, 10] }],
  },
  {
    id: 'gg-sample-3',
    steps: [{ input: '6P' }, { input: '632146HS', window: [4, 14] }],
  },
];

type SampleId = keyof ReturnType<typeof msg>['sampleNames'];

/** 名前は表（msg().sampleNames）から、読んだときの言語で返す getter にする（言語は読み込み後に決まるため） */
function build(json: readonly { id: SampleId }[], rules: NotationRules): ComboRecipe[] {
  return json.map((j) => {
    const r = parseRecipe({ ...j, name: j.id }, rules);
    if (!r.ok) throw new Error(msg().sampleLoadFailed(j.id, r.error));
    return Object.defineProperty(r.recipe, 'name', { get: () => msg().sampleNames[j.id], enumerable: true });
  });
}

export const SF6_SAMPLES: ComboRecipe[] = build(SF6_JSON, SF6_RULES);
export const GG_SAMPLES: ComboRecipe[] = build(GG_JSON, GG_RULES);
