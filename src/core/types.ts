/** テンキー表記。5 がニュートラル。1P 側（右向き）基準。 */
export type Direction = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 1フレーム分の入力。buttons はそのフレームに「押されている」ボタン名。 */
export interface FrameInput {
  dir: Direction;
  buttons: readonly string[];
}

/** モーションの1手。dirs のどれかに入っていれば、その手を満たす。 */
export interface MotionStep {
  dirs: readonly Direction[];
  /** 溜め用。指定時は、この手の方向を「連続で」このフレーム数以上押している必要がある */
  minHold?: number;
}

export type CommandDef =
  | {
      kind: 'motion';
      id: string;
      name: string;
      steps: readonly MotionStep[];
      /** どれか1つの押下で成立 */
      buttons: readonly string[];
      /** 最初の手から最後の手までの最大フレーム数 */
      motionWindow: number;
      /** 最後の手からボタン押下までの最大フレーム数 */
      buttonWindow: number;
    }
  | {
      /** 1回転（360） */
      kind: 'rotation';
      id: string;
      name: string;
      buttons: readonly string[];
      /** ボタン押下フレームから何フレーム前まで見るか */
      motionWindow: number;
    };

export type AttemptResult =
  | { ok: true; motionFrames: number; buttonDelay: number }
  | { ok: false; reason: 'incomplete'; matchedSteps: number; expected: readonly Direction[] }
  | { ok: false; reason: 'too-slow'; motionFrames: number }
  | { ok: false; reason: 'button-late'; buttonDelay: number }
  | { ok: false; reason: 'charge-short'; heldFrames: number }
  | { ok: false; reason: 'rotation-incomplete'; missing: readonly ('left' | 'down' | 'right' | 'up')[] };
