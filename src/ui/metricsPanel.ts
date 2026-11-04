import { histogram, Ring, summarize } from '../core/stats';

export interface MetricsPanel {
  /** rAF ごとに呼ぶ。now は performance.now()、steps はその rAF で進めたフレーム数 */
  readonly onRaf: (now: number, steps: number) => void;
  /** keydown から判定までの遅れ（ms） */
  readonly onKeyLatency: (ms: number) => void;
  /** Gamepad.timestamp が変わったときの差（ms） */
  readonly onPadInterval: (ms: number) => void;
  readonly onStall: () => void;
  readonly setPadPresent: (present: boolean) => void;
}

const fmt = (n: number) => n.toFixed(1);

export function createMetricsPanel(root: HTMLElement): MetricsPanel {
  const box = document.createElement('div');
  box.className = 'metrics';
  const label = document.createElement('label');
  const check = document.createElement('input');
  check.type = 'checkbox';
  label.append(check, ' 計測');
  const body = document.createElement('pre');
  body.hidden = true;
  box.append(label, body);
  root.append(box);

  const steps = new Ring<number>(600);
  const intervals = new Ring<number>(600);
  const keyLat = new Ring<number>(60);
  const padInt = new Ring<number>(60);
  let lastRaf: number | null = null;
  let stalls = 0;
  let padPresent = false;

  const render = () => {
    const h = histogram(steps.values(), 4);
    const total = steps.values().length;
    const pct = (i: number) => (total === 0 ? '-' : `${Math.round(((h[i] ?? 0) / total) * 100)}%`);
    const iv = summarize(intervals.values());
    const k = summarize(keyLat.values());
    const p = summarize(padInt.values());
    const lines = [
      `1回の描画で進んだフレーム数: 0 → ${pct(0)} / 1 → ${pct(1)} / 2 → ${pct(2)} / 3以上 → ${pct(3)}`,
      iv ? `描画の間隔: 平均 ${fmt(iv.mean)} ms（${fmt(1000 / iv.mean)} Hz）` : '描画の間隔: -',
      k ? `キー入力から判定までの遅れ: 平均 ${fmt(k.mean)} ms / 最大 ${fmt(k.max)} ms` : 'キー入力から判定までの遅れ: -',
      !padPresent
        ? 'パッドの更新間隔: パッドなし'
        : p
          ? `パッドの更新間隔: 平均 ${fmt(p.mean)} ms / 最大 ${fmt(p.max)} ms`
          : 'パッドの更新間隔: -',
      `停止の検出回数: ${stalls}`,
    ];
    body.textContent = lines.join('\n');
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  check.addEventListener('change', () => {
    // フォーカスが残ると、Space を割り当てたときにチェックが切り替わってしまうので外す
    check.blur();
    body.hidden = !check.checked;
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (check.checked) {
      render();
      timer = setInterval(render, 500);
    }
    check.blur();
  });

  return {
    onRaf: (now, n) => {
      if (lastRaf !== null) intervals.push(now - lastRaf);
      lastRaf = now;
      steps.push(n);
    },
    onKeyLatency: (ms) => keyLat.push(ms),
    onPadInterval: (ms) => padInt.push(ms),
    onStall: () => {
      stalls++;
    },
    setPadPresent: (present) => {
      padPresent = present;
    },
  };
}
