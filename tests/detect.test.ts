import { describe, expect, it } from 'vitest';
import { analyzeAttempt } from '../src/core/detect';
import type { CommandDef, Direction, FrameInput } from '../src/core/types';

type Spec = Direction | [Direction, string[]];

/** 方向の並びから history を作る。[dir, buttons] でそのフレームのボタンを指定できる */
function frames(...specs: Spec[]): FrameInput[] {
  return specs.map((s) =>
    Array.isArray(s) ? { dir: s[0], buttons: s[1] } : { dir: s, buttons: [] },
  );
}

/** n フレーム分の同じ方向 */
function rep(dir: Direction, n: number): Direction[] {
  return Array.from({ length: n }, () => dir);
}

const LP = ['LP'];

function motion236(motionWindow: number, buttonWindow: number): CommandDef {
  return {
    kind: 'motion',
    notation: 'test',
    id: 'test-236',
    name: 'test 236',
    steps: [{ dirs: [2] }, { dirs: [3] }, { dirs: [6] }],
    buttons: ['LP', 'MP'],
    motionWindow,
    buttonWindow,
  };
}

function charge46(minHold: number, motionWindow: number, buttonWindow: number): CommandDef {
  return {
    kind: 'motion',
    notation: 'test',
    id: 'test-[4]6',
    name: 'test [4]6',
    steps: [{ dirs: [4], minHold }, { dirs: [6] }],
    buttons: ['LP'],
    motionWindow,
    buttonWindow,
  };
}

function rotation(motionWindow: number): CommandDef {
  return { kind: 'rotation', notation: '360', id: 'test-360', name: 'test 360', buttons: ['LP'], motionWindow };
}

describe('analyzeAttempt: 成立 (受け入れ条件 1)', () => {
  it('2,3,6 と同フレームのボタンで成立し、motionFrames と buttonDelay を返す', () => {
    const h = frames(2, 3, [6, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({ ok: true, motionFrames: 2, buttonDelay: 0 });
  });

  it('最後の手からボタンまで離れていれば buttonDelay に反映される', () => {
    const h = frames(2, 3, 6, 5, [5, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({ ok: true, motionFrames: 2, buttonDelay: 2 });
  });

  it('def.buttons のどれでも成立する', () => {
    const h = frames(2, 3, [6, ['MP']]);
    expect(analyzeAttempt(h, motion236(10, 3))).toMatchObject({ ok: true });
  });

  it('同じ方向が続くとき、最後の手は「続いている区間の先頭」になり、前の手はその手前から探す', () => {
    // 6 が 3 フレーム続く (フレーム2〜4)。最後の手 = 区間の先頭 = フレーム2。3 = フレーム1、2 = フレーム0
    const h = frames(2, 3, 6, 6, [6, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({ ok: true, motionFrames: 2, buttonDelay: 2 });
  });
});

describe('analyzeAttempt: 最後の手は「入った瞬間」で数える (受け入れ条件 9)', () => {
  it('例1: 2,3 のあと 6 を 20F 押し続けて P → too-slow ではなく button-late', () => {
    const h = frames(2, 3, ...rep(6, 19), [6, LP]);
    expect(analyzeAttempt(h, motion236(15, 6))).toEqual({ ok: false, reason: 'button-late', buttonDelay: 19 });
  });

  it('例2: 2,3,6,6,6 の最後の 6 で P → motionFrames 2、buttonDelay 2', () => {
    const h = frames(2, 3, 6, 6, [6, LP]);
    expect(analyzeAttempt(h, motion236(15, 6))).toEqual({ ok: true, motionFrames: 2, buttonDelay: 2 });
  });

  it('境界: 最後の手を押し続けた結果 buttonDelay がちょうど buttonWindow なら成立', () => {
    // 6 がフレーム2〜8 (7F)。lastFrame = 2、B = 8 → buttonDelay 6
    const h = frames(2, 3, ...rep(6, 6), [6, LP]);
    expect(analyzeAttempt(h, motion236(15, 6))).toEqual({ ok: true, motionFrames: 2, buttonDelay: 6 });
  });

  it('境界: 最後の手を押し続けた結果 buttonWindow を 1 超えると button-late', () => {
    // 6 がフレーム2〜9 (8F)。lastFrame = 2、B = 9 → buttonDelay 7
    const h = frames(2, 3, ...rep(6, 7), [6, LP]);
    expect(analyzeAttempt(h, motion236(15, 6))).toEqual({ ok: false, reason: 'button-late', buttonDelay: 7 });
  });

  it('最後の手を押し続けても、モーション自体が遅ければ too-slow のまま (too-slow が先)', () => {
    const h = frames(2, ...rep(5, 20), 3, ...rep(6, 10), [6, LP]);
    expect(analyzeAttempt(h, motion236(15, 6))).toMatchObject({ ok: false, reason: 'too-slow' });
  });
});

describe('analyzeAttempt: 手のあいだに別方向が挟まる (受け入れ条件 2)', () => {
  it('2→1→3→6 で 236 が成立する', () => {
    const h = frames(2, 1, 3, [6, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({ ok: true, motionFrames: 3, buttonDelay: 0 });
  });

  it('ニュートラルが挟まっても時間内なら成立する', () => {
    const h = frames(2, 5, 5, 3, 5, [6, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({ ok: true, motionFrames: 5, buttonDelay: 0 });
  });
});

describe('analyzeAttempt: 後ろから貪欲に探す', () => {
  it('古い 2 が猶予外でも、新しい 2,3,6 で成立する', () => {
    const h = frames(2, ...rep(5, 20), 2, 3, [6, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({ ok: true, motionFrames: 2, buttonDelay: 0 });
  });
});

describe('analyzeAttempt: 猶予の境界 (受け入れ条件 1)', () => {
  it('motionFrames がちょうど motionWindow なら成立', () => {
    // 2 がフレーム0、6 がフレーム 5 → motionFrames 5
    const h = frames(2, 5, 5, 3, 5, [6, LP]);
    expect(analyzeAttempt(h, motion236(5, 3))).toMatchObject({ ok: true, motionFrames: 5 });
  });

  it('motionFrames が motionWindow を 1 フレーム超えると too-slow', () => {
    const h = frames(2, 5, 5, 3, 5, [6, LP]);
    expect(analyzeAttempt(h, motion236(4, 3))).toEqual({ ok: false, reason: 'too-slow', motionFrames: 5 });
  });

  it('buttonDelay がちょうど buttonWindow なら成立', () => {
    const h = frames(2, 3, 6, 5, 5, [5, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({ ok: true, motionFrames: 2, buttonDelay: 3 });
  });

  it('buttonDelay が buttonWindow を 1 フレーム超えると button-late', () => {
    const h = frames(2, 3, 6, 5, 5, [5, LP]);
    expect(analyzeAttempt(h, motion236(10, 2))).toEqual({ ok: false, reason: 'button-late', buttonDelay: 3 });
  });

  it('too-slow と button-late が両方当てはまるときは too-slow が先', () => {
    const h = frames(2, 5, 5, 3, 6, 5, 5, [5, LP]);
    const r = analyzeAttempt(h, motion236(3, 1));
    expect(r).toMatchObject({ ok: false, reason: 'too-slow' });
  });
});

describe('analyzeAttempt: incomplete (前向き探索で matchedSteps / expected)', () => {
  it('最後の手が足りない: matchedSteps 2、expected は次の手の dirs', () => {
    const h = frames(2, 3, [5, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({
      ok: false,
      reason: 'incomplete',
      matchedSteps: 2,
      expected: [6],
    });
  });

  it('何も合わなければ matchedSteps 0、expected は最初の手の dirs', () => {
    const h = frames(5, 5, [5, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({
      ok: false,
      reason: 'incomplete',
      matchedSteps: 0,
      expected: [2],
    });
  });

  it('順番が逆 (3,2) なら 2 まで進んで 3 待ち', () => {
    const h = frames(3, 2, [5, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toEqual({
      ok: false,
      reason: 'incomplete',
      matchedSteps: 1,
      expected: [3],
    });
  });

  it('範囲 max(0, B-(motionWindow+buttonWindow)) より前の入力は数えない', () => {
    // motionWindow 4 + buttonWindow 2 = 6。B = 9、範囲は 3〜9。フレーム0 の 2 は範囲外
    const h = frames(2, ...rep(5, 8), [5, LP]);
    expect(analyzeAttempt(h, motion236(4, 2))).toEqual({
      ok: false,
      reason: 'incomplete',
      matchedSteps: 0,
      expected: [2],
    });
  });

  it('範囲の端 (B-(motionWindow+buttonWindow)) のフレームは数える', () => {
    // B = 6、範囲は 0〜6。フレーム0 の 2 は範囲内
    const h = frames(2, ...rep(5, 5), [5, LP]);
    expect(analyzeAttempt(h, motion236(4, 2))).toEqual({
      ok: false,
      reason: 'incomplete',
      matchedSteps: 1,
      expected: [3],
    });
  });

  it('履歴 1 フレームでボタンを押していれば、押された扱いで incomplete になる (null ではない)', () => {
    const h = frames([5, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toMatchObject({ ok: false, reason: 'incomplete' });
  });
});

describe('analyzeAttempt: 溜め (minHold)', () => {
  it('溜めがちょうど minHold フレームなら成立。motionFrames は溜め終わりから数える', () => {
    // 4 が3フレーム(0-2) → 6 がフレーム3。f = 2、motionFrames = 1
    const h = frames(4, 4, 4, [6, LP]);
    expect(analyzeAttempt(h, charge46(3, 10, 3))).toEqual({ ok: true, motionFrames: 1, buttonDelay: 0 });
  });

  it('溜めが 1 フレーム足りなければ charge-short と heldFrames', () => {
    const h = frames(4, 4, [6, LP]);
    expect(analyzeAttempt(h, charge46(3, 10, 3))).toEqual({ ok: false, reason: 'charge-short', heldFrames: 2 });
  });

  it('溜めの長さは motionWindow に含めない', () => {
    const h = frames(...rep(4, 30), [6, LP]);
    expect(analyzeAttempt(h, charge46(3, 2, 3))).toEqual({ ok: true, motionFrames: 1, buttonDelay: 0 });
  });

  it('heldFrames は f から前へ連続して dirs に入るフレーム数 (途中で途切れたらそこまで)', () => {
    // 4,4,5,4,4 → 6。f = フレーム4。連続は フレーム3,4 の 2 フレーム
    const h = frames(4, 4, 5, 4, 4, [6, LP]);
    expect(analyzeAttempt(h, charge46(3, 10, 3))).toEqual({ ok: false, reason: 'charge-short', heldFrames: 2 });
  });

  it('dirs が複数の溜めは、dirs に入る方向が混ざっていても連続として数える', () => {
    const def: CommandDef = {
      kind: 'motion',
      notation: 'test',
      id: 'test-back-charge',
      name: 'test back charge',
      steps: [{ dirs: [1, 4, 7], minHold: 3 }, { dirs: [6] }],
      buttons: ['LP'],
      motionWindow: 10,
      buttonWindow: 3,
    };
    const h = frames(4, 1, 4, [6, LP]);
    expect(analyzeAttempt(h, def)).toMatchObject({ ok: true });
  });

  it('溜めが最初の手の [2]8K 型でも溜め不足を検出する', () => {
    const def: CommandDef = {
      kind: 'motion',
      notation: 'test',
      id: 'test-[2]8K',
      name: 'test [2]8K',
      steps: [{ dirs: [2], minHold: 4 }, { dirs: [8] }],
      buttons: ['LK'],
      motionWindow: 10,
      buttonWindow: 3,
    };
    const h = frames(2, 2, 2, 8, [8, ['LK']]);
    expect(analyzeAttempt(h, def)).toEqual({ ok: false, reason: 'charge-short', heldFrames: 3 });
  });

  describe('溜めが 2 手目 (最後の手) にある場合', () => {
    function secondStepCharge(minHold: number): CommandDef {
      return {
        kind: 'motion',
        notation: 'test',
        id: 'test-2[8]',
        name: 'test 2[8]',
        steps: [{ dirs: [2] }, { dirs: [8], minHold }],
        buttons: ['LK'],
        motionWindow: 10,
        buttonWindow: 5,
      };
    }

    it('2 手目の溜めが足りなければ charge-short と heldFrames', () => {
      const h = frames(2, 8, [8, ['LK']]);
      expect(analyzeAttempt(h, secondStepCharge(3))).toEqual({ ok: false, reason: 'charge-short', heldFrames: 2 });
    });

    it('2 手目の溜めがちょうど minHold なら成立', () => {
      const h = frames(2, 8, 8, [8, ['LK']]);
      expect(analyzeAttempt(h, secondStepCharge(3))).toMatchObject({ ok: true });
    });
  });

  it('最後の手に minHold があるとき、heldFrames は区間の先頭ではなく f (B 以下で最も新しいフレーム) から数える', () => {
    // 2,8,8,8,[8,LK]: 8 は フレーム1〜4。f = 4、lastFrame (区間の先頭) = 1
    // f から数えると heldFrames = 4 (minHold 4 を満たす)。lastFrame から数えると 1 で不足になってしまう
    const def: CommandDef = {
      kind: 'motion',
      notation: 'test',
      id: 'test-2[8]-hold',
      name: 'test 2[8] hold',
      steps: [{ dirs: [2] }, { dirs: [8], minHold: 4 }],
      buttons: ['LK'],
      motionWindow: 10,
      buttonWindow: 5,
    };
    const h = frames(2, 8, 8, 8, [8, ['LK']]);
    expect(analyzeAttempt(h, def)).toEqual({ ok: true, motionFrames: 1, buttonDelay: 3 });
  });

  it('charge-short は too-slow より優先される', () => {
    // 溜め2フレーム、その後 5 が長く続いて 6。motionFrames は motionWindow を超える
    const h = frames(4, 4, ...rep(5, 6), [6, LP]);
    expect(analyzeAttempt(h, charge46(3, 2, 3))).toEqual({ ok: false, reason: 'charge-short', heldFrames: 2 });
  });

  it('incomplete は charge-short より優先される', () => {
    const h = frames(4, 4, [5, LP]);
    expect(analyzeAttempt(h, charge46(3, 10, 3))).toMatchObject({ ok: false, reason: 'incomplete' });
  });
});

describe('analyzeAttempt: rotation (360)', () => {
  it('4,2,6,8 で 4 グループが揃えば成立。motionFrames は B - 最初のグループ入りフレーム', () => {
    const h = frames(4, 2, 6, [8, LP]);
    expect(analyzeAttempt(h, rotation(20))).toEqual({ ok: true, motionFrames: 3, buttonDelay: 0 });
  });

  it('順番は問わない (逆回しでも成立)', () => {
    const h = frames(8, 6, 2, [4, LP]);
    expect(analyzeAttempt(h, rotation(20))).toMatchObject({ ok: true, buttonDelay: 0 });
  });

  it('斜めは両方のグループに数える (1,3,9,7)', () => {
    const h = frames(1, 3, 9, [7, LP]);
    expect(analyzeAttempt(h, rotation(20))).toMatchObject({ ok: true });
  });

  it('最初のグループ入りより前のニュートラルは motionFrames に数えない', () => {
    const h = frames(5, 5, 4, 2, 6, [8, LP]);
    expect(analyzeAttempt(h, rotation(20))).toEqual({ ok: true, motionFrames: 3, buttonDelay: 0 });
  });

  it('足りないグループを left, down, right, up の順で missing に入れる', () => {
    const h = frames(5, 5, 5, [6, LP]);
    expect(analyzeAttempt(h, rotation(20))).toEqual({
      ok: false,
      reason: 'rotation-incomplete',
      missing: ['left', 'down', 'up'],
    });
  });

  it('up だけ足りない場合', () => {
    const h = frames(4, 2, 6, [5, LP]);
    expect(analyzeAttempt(h, rotation(20))).toEqual({
      ok: false,
      reason: 'rotation-incomplete',
      missing: ['up'],
    });
  });

  it('範囲は B - motionWindow から。ちょうど端のフレームは数える', () => {
    // B = 4, motionWindow 4 → 範囲 0〜4。フレーム0 の 4 (left) は範囲内
    const h = frames(4, 2, 6, 5, [8, LP]);
    expect(analyzeAttempt(h, rotation(4))).toEqual({ ok: true, motionFrames: 4, buttonDelay: 0 });
  });

  it('範囲より 1 フレーム前の入力は数えない', () => {
    // B = 5, motionWindow 4 → 範囲 1〜5。フレーム0 の 4 (left) は範囲外
    const h = frames(4, 2, 6, 8, 5, [5, LP]);
    expect(analyzeAttempt(h, rotation(4))).toEqual({
      ok: false,
      reason: 'rotation-incomplete',
      missing: ['left'],
    });
  });
});

describe('analyzeAttempt: 押した瞬間でなければ null (受け入れ条件 1, 3)', () => {
  it('いまのフレームでボタンが押されていなければ null', () => {
    const h = frames(2, 3, 6);
    expect(analyzeAttempt(h, motion236(10, 3))).toBeNull();
  });

  it('def.buttons にないボタンだけなら null', () => {
    const h = frames(2, 3, [6, ['HK']]);
    expect(analyzeAttempt(h, motion236(10, 3))).toBeNull();
  });

  it('押しっぱなしのフレームでは null', () => {
    const h = frames(2, 3, [6, LP], [6, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).toBeNull();
  });

  it('一度離してもう一度押せば判定される', () => {
    const h = frames(2, 3, [6, LP], 6, [6, LP]);
    expect(analyzeAttempt(h, motion236(10, 3))).not.toBeNull();
  });

  it('別のボタンを押しっぱなしでも、対象ボタンを新しく押せば判定される', () => {
    const h = frames(2, 3, [6, ['MP']], [6, ['MP', 'LP']]);
    expect(analyzeAttempt(h, motion236(10, 3))).not.toBeNull();
  });

  it('対象ボタンの 1 つを押しっぱなしで、他の対象ボタンを足していなければ null', () => {
    const h = frames(2, 3, [6, ['MP']], [6, ['MP']]);
    expect(analyzeAttempt(h, motion236(10, 3))).toBeNull();
  });

  it('rotation でも押しっぱなしは null', () => {
    const h = frames(4, 2, 6, [8, LP], [8, LP]);
    expect(analyzeAttempt(h, rotation(20))).toBeNull();
  });

  it('rotation でも押していなければ null', () => {
    const h = frames(4, 2, 6, 8);
    expect(analyzeAttempt(h, rotation(20))).toBeNull();
  });
});

describe('analyzeAttempt: 隣り合う手の方向が重なる定義（変更 2）', () => {
  const dash66: CommandDef = {
    kind: 'motion',
    notation: 'test',
    id: 'test-66',
    name: 'test 66',
    steps: [{ dirs: [6] }, { dirs: [6] }],
    buttons: ['LP'],
    motionWindow: 15,
    buttonWindow: 6,
  };

  it('6 を押しっぱなしでは 66 にならず、例外も投げない', () => {
    const h = frames(6, 6, [6, LP]);
    expect(analyzeAttempt(h, dash66)).toEqual({
      ok: false,
      reason: 'incomplete',
      matchedSteps: 1,
      expected: [6],
    });
  });

  it('6,5,6 なら 66 が成立する', () => {
    const h = frames(6, 5, [6, LP]);
    expect(analyzeAttempt(h, dash66)).toEqual({ ok: true, motionFrames: 2, buttonDelay: 0 });
  });

  it('前向き探索だけで全手が揃うときも例外を投げず、最後の手を expected にする', () => {
    const def: CommandDef = {
      kind: 'motion',
      notation: 'test',
      id: 'test-overlap',
      name: 'test overlap',
      steps: [{ dirs: [6] }, { dirs: [3, 6] }],
      buttons: ['LP'],
      motionWindow: 15,
      buttonWindow: 6,
    };
    const h = frames(6, [3, LP]);
    expect(analyzeAttempt(h, def)).toEqual({
      ok: false,
      reason: 'incomplete',
      matchedSteps: 1,
      expected: [3, 6],
    });
  });
});
