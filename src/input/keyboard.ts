import { ACTIONS, type Action, type Bindings } from './bindings';
import { KeyTimeline } from './timeline';

/** 文字を打つ種類の input の type（type 省略は text 扱い） */
const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'number', 'password', 'url', 'tel']);

/**
 * 文字を打つ欄（とキーで選ぶ select）か。ここから来たキーはゲーム入力として扱わない。
 * チェックボックスやボタンの input は含めない（クリック後にフォーカスが残るとキーを全部捨ててしまうため）
 */
export function isTextEntry(tagName: string, type: string | null, editable: boolean): boolean {
  if (editable) return true;
  if (tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  if (tagName === 'INPUT') return TEXT_INPUT_TYPES.has((type ?? '').toLowerCase());
  return false;
}

function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && isTextEntry(t.tagName, t.getAttribute('type'), t.isContentEditable);
}

/** キーボードのイベントを時刻付きで timeline に積み、フレームごとの押下状態を返す */
export class KeyboardReader {
  private timeline = new KeyTimeline();
  /** まだ取り出していない keydown の時刻（計測用） */
  private downTimes: number[] = [];
  /** 次に押されたキーを受け取るコールバック（キーコンフィグ用） */
  captureNext: ((code: string) => void) | null = null;
  /** まだ取り出していない「キーが押された瞬間」があるか（操作中のデバイスの判定用。キーコンフィグの捕まえ中は数えない） */
  private anyKeyDown = false;

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
      this.anyKeyDown = true;
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

  /** 前回呼んでから何かのキーが押されたかを返し、印を下ろす */
  takeAnyKeyDown(): boolean {
    const v = this.anyKeyDown;
    this.anyKeyDown = false;
    return v;
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
