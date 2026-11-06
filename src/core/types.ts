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

/** 検索だけに使う別名。キャラの技は、表示していない言語の名前も入れて、どちらの言語でも探せるようにする */
interface Searchable {
  searchNames?: readonly string[];
}

export type CommandDef = Searchable &
  ({
      kind: 'motion';
      id: string;
      name: string;
      /** 表記のときの方向の部分 例: '236'、'[4]6' */
      notation: string;
      steps: readonly MotionStep[];
      /** どれか1つの押下で成立 */
      buttons: readonly string[];
      /** 最初の手から最後の手までの最大フレーム数 */
      motionWindow: number;
      /** 最後の手からボタン押下までの最大フレーム数 */
      buttonWindow: number;
      /** 手と手の間の最大フレーム数。長さは steps.length - 1 で、stepGaps[k] は手 k から手 k+1 まで。ないコマンドは motionWindow だけで見る。隣り合う手の方向は重ならない前提（重なると手の間が 0 以下になりうる） */
      stepGaps?: readonly number[];
    }
  | {
      /** 1回転（360） */
      kind: 'rotation';
      id: string;
      name: string;
      /** 表記のときの方向の部分 例: '360' */
      notation: string;
      buttons: readonly string[];
      /** ボタン押下フレームから何フレーム前まで見るか */
      motionWindow: number;
    });

/**
 * コマンド練習の派生の項目（親の技のあとに入れる入力。例: 236K~P）。
 * 入力の履歴だけでは成否が決まらない（親の技が出ているかを見る）ので CommandDef には入れず、
 * analyzeAttempt の対象ではない。キャラの動きで判定する（followUp.ts の judgePracticeFollowUp）
 */
export interface FollowUpDef extends Searchable {
  kind: 'followUp';
  id: string;
  name: string;
  /** 表記 例: '236K~P'、'236P>K' */
  notation: string;
  /** 派生のボタン（押した瞬間が試し） */
  buttons: readonly string[];
}

/** コマンド練習の一覧の項目（コマンドか、派生） */
export type PracticeDef = CommandDef | FollowUpDef;
export type AttemptResult =
  | { ok: true; motionFrames: number; buttonDelay: number }
  | { ok: false; reason: 'incomplete'; matchedSteps: number; expected: readonly Direction[] }
  | { ok: false; reason: 'too-slow'; motionFrames: number }
  | {
      ok: false;
      reason: 'step-slow';
      /** 遅かった手の番号（0 から数える） */
      stepIndex: number;
      frames: number;
      limit: number;
      /** 前の手と遅かった手の方向 */
      from: readonly Direction[];
      to: readonly Direction[];
    }
  | { ok: false; reason: 'button-late'; buttonDelay: number }
  | { ok: false; reason: 'charge-short'; heldFrames: number }
  | { ok: false; reason: 'rotation-incomplete'; missing: readonly ('left' | 'down' | 'right' | 'up')[] };
