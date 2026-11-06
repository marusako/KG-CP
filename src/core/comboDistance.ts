// コンボトライアルの距離（近S・遠S のどちらが出るか）をレシピから決める（第20段階）。
import type { StepInput } from './notation';
import type { Distance } from './settings';

/** 手の距離。c.S（range close）は 'close'、f.S（range far）は 'far'、それ以外は null */
function stepDistance(step: StepInput | undefined): Distance | null {
  if (step?.kind !== 'normal') return null;
  return step.range ?? null;
}

/**
 * レシピの手 steps で、次に押すのが手 next のためのときの距離。
 * next の手が c.S なら 'close'、f.S なら 'far'、それ以外は prev。
 * next が 0 なら、レシピの最初の c.S・f.S の手に合わせる（なければ 'close'）
 */
export function recipeDistance(steps: readonly StepInput[], next: number, prev: Distance): Distance {
  if (next === 0) {
    for (const s of steps) {
      const d = stepDistance(s);
      if (d !== null) return d;
    }
    return 'close';
  }
  return stepDistance(steps[next]) ?? prev;
}
