import { ACTIONS, type Action, type Bindings } from './bindings';
import { KeyTimeline } from './timeline';

/** 文字入力用の要素から来たイベントか（ゲーム入力として扱わない） */
function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

/** キーボードのイベントを時刻付きで timeline に積み、フレームごとの押下状態を返す */
export class KeyboardReader {
  private timeline = new KeyTimeline();
  /** まだ取り出していない keydown の時刻（計測用） */
  private downTimes: number[] = [];
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
      if (e.repeat) return;
      this.timeline.push({ code: e.code, down: true, time: e.timeStamp });
      this.downTimes.push(e.timeStamp);
    });
    target.addEventListener('keyup', (e) => {
      this.timeline.push({ code: e.code, down: false, time: e.timeStamp });
    });
    target.addEventListener('blur', () => {
      this.timeline.clear();
      this.downTimes = [];
    });
  }

  /**
   * frameEnd までのイベントを反映して、そのフレームの操作を返す。
   * downTimes は今回取り出した keydown の時刻（遅れの計測用）
   */
  sample(frameEnd: number, bindings: Bindings): { actions: Record<Action, boolean>; downTimes: number[] } {
    const set = this.timeline.sample(frameEnd);
    const actions = {} as Record<Action, boolean>;
    for (const a of ACTIONS) actions[a] = set.has(bindings.keys[a]);
    const taken = this.downTimes.filter((t) => t < frameEnd);
    this.downTimes = this.downTimes.filter((t) => t >= frameEnd);
    return { actions, downTimes: taken };
  }
}
