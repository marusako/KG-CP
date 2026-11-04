import { ACTIONS, type Action, type Bindings } from './bindings';

/** 文字入力用の要素から来たイベントか（ゲーム入力として扱わない） */
function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

/** キーボードの押下状態を保持する */
export class KeyboardReader {
  private down = new Set<string>();
  /** 次に押されたキーを受け取るコールバック（キーコンフィグ用） */
  captureNext: ((code: string) => void) | null = null;

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      if (isTextTarget(e.target)) return;
      if (this.captureNext) {
        e.preventDefault();
        const cb = this.captureNext;
        this.captureNext = null;
        cb(e.code);
        return;
      }
      this.down.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    target.addEventListener('blur', () => this.down.clear());
  }

  read(bindings: Bindings): Record<Action, boolean> {
    const out = {} as Record<Action, boolean>;
    for (const a of ACTIONS) out[a] = this.down.has(bindings.keys[a]);
    return out;
  }
}
