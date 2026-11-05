import { msg } from '../i18n/messages';
import { histogram, RafMeter, Ring, summarize } from '../core/stats';

export interface MetricsPanel {
  /** rAF ごとに呼ぶ。now は performance.now()、steps はその rAF で進めたフレーム数、stalled は停止を検出した回か */
  readonly onRaf: (now: number, steps: number, stalled: boolean) => void;
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
  label.append(check, msg().metricsLabel);
  const body = document.createElement('pre');
  body.hidden = true;
  box.append(label, body);
  root.append(box);

  const raf = new RafMeter(600);
  const keyLat = new Ring<number>(60);
  const padInt = new Ring<number>(60);
  let stalls = 0;
  let padPresent = false;

  const render = () => {
    const stepValues = raf.steps();
    const h = histogram(stepValues, 4);
    const total = stepValues.length;
    const pct = (i: number) => (total === 0 ? '-' : `${Math.round(((h[i] ?? 0) / total) * 100)}%`);
    const iv = summarize(raf.intervals());
    const k = summarize(keyLat.values());
    const p = summarize(padInt.values());
    const m = msg();
    const lines = [
      m.metricsSteps(pct(0), pct(1), pct(2), pct(3)),
      iv ? m.metricsInterval(fmt(iv.mean), fmt(1000 / iv.mean)) : m.metricsIntervalNone,
      k ? m.metricsKey(fmt(k.mean), fmt(k.max)) : m.metricsKeyNone,
      !padPresent ? m.metricsPadAbsent : p ? m.metricsPad(fmt(p.mean), fmt(p.max)) : m.metricsPadNone,
      m.metricsStalls(stalls),
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
    onRaf: (now, n, stalled) => raf.onRaf(now, n, stalled),
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
