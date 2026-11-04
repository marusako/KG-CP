import type { AttemptResult, CommandDef } from '../core/types';

const RECENT_ATTEMPTS = 20;

const DIR_LABEL = { left: '左', down: '下', right: '右', up: '上' } as const;

export function describeResult(r: AttemptResult): string {
  if (r.ok) return `成立！ モーション ${r.motionFrames}F / ボタン遅れ ${r.buttonDelay}F`;
  switch (r.reason) {
    case 'incomplete':
      if (r.matchedSteps === 0) return `最初の手（${r.expected.join('/')}）が入っていません`;
      return `手が足りません（${r.matchedSteps} 手目まで成功。次は ${r.expected.join('/')}）`;
    case 'too-slow':
      return `モーションが遅すぎます（${r.motionFrames}F）`;
    case 'button-late':
      return `ボタンが遅すぎます（最後の手から ${r.buttonDelay}F）`;
    case 'charge-short':
      return `溜めが足りません（${r.heldFrames}F）`;
    case 'rotation-incomplete':
      return `回転が足りません（足りない方向: ${r.missing.map((m) => DIR_LABEL[m]).join('・')}）`;
  }
}

export interface CommandPanel {
  readonly selected: () => CommandDef;
  readonly showResult: (r: AttemptResult) => void;
}

export function createCommandPanel(root: HTMLElement, commands: readonly CommandDef[]): CommandPanel {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = '練習するコマンド';
  const list = document.createElement('div');
  list.className = 'command-list';
  const result = document.createElement('div');
  result.className = 'result';
  result.textContent = 'ボタンを押すと判定します';
  const rate = document.createElement('div');
  rate.className = 'note';
  section.append(title, list, result, rate);
  root.append(section);

  let current = commands[0] as CommandDef;
  let recent: boolean[] = [];

  const updateRate = () => {
    const ok = recent.filter(Boolean).length;
    rate.textContent =
      recent.length === 0
        ? `直近の成功率: -`
        : `直近の成功率: ${Math.round((ok / recent.length) * 100)}%（${ok}/${recent.length}）`;
  };
  updateRate();

  const buttons = commands.map((c) => {
    const b = document.createElement('button');
    b.textContent = c.name;
    b.addEventListener('click', () => {
      current = c;
      recent = [];
      buttons.forEach((x) => x.classList.toggle('active', x === b));
      result.className = 'result';
      result.textContent = 'ボタンを押すと判定します';
      updateRate();
      b.blur();
    });
    return b;
  });
  buttons[0]?.classList.add('active');
  list.append(...buttons);

  return {
    selected: () => current,
    showResult: (r) => {
      result.className = `result ${r.ok ? 'ok' : 'ng'}`;
      result.textContent = describeResult(r);
      recent.push(r.ok);
      if (recent.length > RECENT_ATTEMPTS) recent.shift();
      updateRate();
    },
  };
}
