import { msg } from '../i18n/messages';
import type { NotationRules } from './notation';
import type { CommandDef, Direction, MotionStep } from './types';

const PUNCH = ['LP', 'MP', 'HP'] as const;
const KICK = ['LK', 'MK', 'HK'] as const;

// 仮の値。スト6 のモーション全体の猶予は出典が見つからず、共通の値を使う。
// GG は一部のコマンドだけ Dustloop の値で（ggStepMotion）、それ以外（236236・214214・360）は共通の値を使う。
// BUTTON_WINDOW も仮（スト6 の一部は下の SF6_BUTTON_WINDOW）
const MOTION_WINDOW = 15;
const LONG_MOTION_WINDOW = 25;
const BUTTON_WINDOW = 6;

// スト6 の「最後の方向からボタンまで」の猶予。
// 出典: Season 2 の公式パッチノート（2024-05-21）。公式のページそのものではなく、
// 引用している EventHubs の記事で確認した（https://www.eventhubs.com/news/2024/may/21/sf6-season-2-patch-notes）。
// 「最後の前（または後ろ）の入力から 9 フレーム以内に攻撃ボタンを押す」とあり、
// 地上の 236・214 は 11F→9F、41236・63214 は 12F→9F。
// 読み替え（推測）: 「9F」を「ボタンを押してよいフレームが 9 通り」と読み、最後の方向と同じフレームを 0 として 8 にした。
// 623 は有志の検証（WydD、2023 年、https://rentry.co/35ch3）で 7F とあり、同じ読み替えで 6（今のまま）。
// 623 が Season 2 以降に変わったかは確認できていない。
// 確認日: 2026-11-05。実機での確認は docs/manual-checks.md の 10
const SF6_BUTTON_WINDOW = 8;

const step = (...dirs: Direction[]): MotionStep => ({ dirs });

type WithoutName<T> = T extends unknown ? Omit<T, 'name'> : never;

/**
 * name を、読んだときの言語で返す getter にしたコマンドを作る。
 * 言語は読み込み後に決まるので、値として持たない。spread（{ ...c }）すると getter は値になるので、コピーするときは named で作り直す
 */
function named(def: WithoutName<CommandDef>, name: () => string): CommandDef {
  return Object.defineProperty({ ...def }, 'name', { get: name, enumerable: true }) as CommandDef;
}

export const SF6_COMMANDS: CommandDef[] = [
  named(
    {
      kind: 'motion',
      id: '236P',
      notation: '236',
      steps: [step(2), step(3), step(6)],
      buttons: PUNCH,
      motionWindow: MOTION_WINDOW,
      buttonWindow: SF6_BUTTON_WINDOW,
    },
    () => `${msg().cmd.fireball} (236P)`,
  ),
  named(
    {
      kind: 'motion',
      id: '214P',
      notation: '214',
      steps: [step(2), step(1), step(4)],
      buttons: PUNCH,
      motionWindow: MOTION_WINDOW,
      buttonWindow: SF6_BUTTON_WINDOW,
    },
    () => `${msg().cmd.reverseFireball} (214P)`,
  ),
  named(
    {
      kind: 'motion',
      id: '623P',
      notation: '623',
      steps: [step(6), step(2), step(3)],
      buttons: PUNCH,
      motionWindow: MOTION_WINDOW,
      buttonWindow: BUTTON_WINDOW,
    },
    () => `${msg().cmd.dragonPunch} (623P)`,
  ),
  named(
    {
      kind: 'motion',
      id: '41236P',
      notation: '41236',
      steps: [step(4), step(1), step(2), step(3), step(6)],
      buttons: PUNCH,
      motionWindow: LONG_MOTION_WINDOW,
      buttonWindow: SF6_BUTTON_WINDOW,
    },
    () => `${msg().cmd.halfCircle} (41236P)`,
  ),
  named(
    {
      kind: 'motion',
      id: '63214P',
      notation: '63214',
      steps: [step(6), step(3), step(2), step(1), step(4)],
      buttons: PUNCH,
      motionWindow: LONG_MOTION_WINDOW,
      buttonWindow: SF6_BUTTON_WINDOW,
    },
    () => `${msg().cmd.reverseHalfCircle} (63214P)`,
  ),
  named(
    {
      kind: 'motion',
      id: '[4]6P',
      notation: '[4]6',
      steps: [{ dirs: [1, 4, 7], minHold: 40 }, step(6)],
      buttons: PUNCH,
      motionWindow: MOTION_WINDOW,
      buttonWindow: BUTTON_WINDOW,
    },
    () => `${msg().cmd.charge} ([4]6P)`,
  ),
  named(
    {
      kind: 'motion',
      id: '[2]8K',
      notation: '[2]8',
      steps: [{ dirs: [1, 2, 3], minHold: 40 }, step(7, 8, 9)],
      buttons: KICK,
      motionWindow: MOTION_WINDOW,
      buttonWindow: BUTTON_WINDOW,
    },
    () => `${msg().cmd.charge} ([2]8K)`,
  ),
  named(
    {
      kind: 'rotation',
      id: '360P',
      notation: '360',
      buttons: PUNCH,
      motionWindow: 40,
    },
    () => `${msg().cmd.rotation} (360P)`,
  ),
];

const SF6_BUTTONS = ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'] as const;

/**
 * スト6 の表記用のモーション一覧。方向の部分ごとに 1 つで、ボタンは 6 つ全部。
 * これで 236K・623K・236236K のように、技ごとのボタンで書けるようになる（parseStep が表記のボタンで絞る）。
 * 方向・猶予・溜めは SF6_COMMANDS の同じ表記のものと同じ。
 * 236236・214214 の猶予は 236・214 を 2 回続けるものとして、LONG_MOTION_WINDOW と BUTTON_WINDOW を使う（どちらも仮の値）
 */
export const SF6_MOTIONS: CommandDef[] = [
  ...SF6_COMMANDS.map((c) =>
    named({ ...c, id: `sf6-${c.notation}`, buttons: SF6_BUTTONS }, () => msg().motionPlusButton(c.notation)),
  ),
  named(
    {
      kind: 'motion',
      id: 'sf6-236236',
      notation: '236236',
      steps: [step(2), step(3), step(6), step(2), step(3), step(6)],
      buttons: SF6_BUTTONS,
      motionWindow: LONG_MOTION_WINDOW,
      buttonWindow: BUTTON_WINDOW,
    },
    () => msg().motionPlusButton('236236'),
  ),
  named(
    {
      kind: 'motion',
      id: 'sf6-214214',
      notation: '214214',
      steps: [step(2), step(1), step(4), step(2), step(1), step(4)],
      buttons: SF6_BUTTONS,
      motionWindow: LONG_MOTION_WINDOW,
      buttonWindow: BUTTON_WINDOW,
    },
    () => msg().motionPlusButton('214214'),
  ),
];

const GG_BUTTONS = ['P', 'K', 'S', 'HS', 'D'] as const;

const plus = (notation: string) => () => msg().motionPlusButton(notation);

/** GG のコマンド 1 つ。猶予は共通の値 */
const ggMotion = (notation: string, name: () => string, steps: readonly MotionStep[], motionWindow: number): CommandDef =>
  named(
    {
      kind: 'motion',
      id: `gg-${notation}`,
      notation,
      steps,
      buttons: GG_BUTTONS,
      motionWindow,
      buttonWindow: BUTTON_WINDOW,
    },
    name,
  );

/**
 * GG のコマンド 1 つ。手の間とボタンまでの猶予を、Dustloop の値で決める。motionWindow は手の間の合計。
 * 出典: Dustloop「GGST - Esoterica」（https://www.dustloop.com/w/GGST/Esoterica 。本体は自動の取得を拒否するので、検索結果の抜粋で確認）と、
 * その翻訳の有志のまとめ（Notion、2026-10-26 更新、URL は profiles.ts のコメント）。確認日: 2026-11-05。
 * 表記は「i-5-10-9e」のように、i が最初の入力（離すまで覚えられる）、数が前の手から次の手までの時間。
 * 読み替え（推測）:
 * - e の意味は書かれていない。「最後の方向からボタンまで」と読んだ（数の個数が「手の数 − 1 ＋ 1」になるため）
 * - 数は「前の手を入れたフレームから次の手を入れたフレームまでの差」の最大で、「数 − 1」にせず数のまま使う
 * - 最初の手だけは離したフレームから数える（i の説明から）
 */
const ggStepMotion = (
  notation: string,
  name: () => string,
  steps: readonly MotionStep[],
  stepGaps: readonly number[],
  buttonWindow: number,
): CommandDef =>
  named(
    {
      kind: 'motion',
      id: `gg-${notation}`,
      notation,
      steps,
      buttons: GG_BUTTONS,
      motionWindow: stepGaps.reduce((a, b) => a + b, 0),
      buttonWindow,
      stepGaps,
    },
    name,
  );

export const GG_COMMANDS: CommandDef[] = [
  // 236 は i-5-10-9e
  ggStepMotion('236', plus('236'), [step(2), step(3), step(6)], [5, 10], 9),
  // 214 と 63214 は Dustloop の表にない。236・41236 の左右を入れ替えた形なので、同じ値にした（推測）
  ggStepMotion('214', plus('214'), [step(2), step(1), step(4)], [5, 10], 9),
  // 623 は i-8-12-6e
  ggStepMotion('623', plus('623'), [step(6), step(2), step(3)], [8, 12], 6),
  // 41236 は i-5-12-12-12-11e
  ggStepMotion('41236', plus('41236'), [step(4), step(1), step(2), step(3), step(6)], [5, 12, 12, 12], 11),
  ggStepMotion('63214', plus('63214'), [step(6), step(3), step(2), step(1), step(4)], [5, 12, 12, 12], 11),
  // 632146 は i-6-12-12-12-12-11e
  ggStepMotion('632146', plus('632146'), [step(6), step(3), step(2), step(1), step(4), step(6)], [6, 12, 12, 12, 12], 11),
  // 236236・214214 は、手の形が Dustloop（2-6-2-6）と違うので、共通の値のまま
  ggMotion('236236', plus('236236'), [step(2), step(3), step(6), step(2), step(3), step(6)], LONG_MOTION_WINDOW),
  ggMotion('214214', plus('214214'), [step(2), step(1), step(4), step(2), step(1), step(4)], LONG_MOTION_WINDOW),
  // [4]6 は 30i-10-9e。30i を「溜め 30F 以上」と読むのは推測。溜めは Dustloop の 30F を使う（まとめの表には「4（25F）」ともあり、食い違う）
  ggStepMotion('[4]6', () => msg().chargePlusButton('[4]6'), [{ dirs: [1, 4, 7], minHold: 30 }, step(6)], [10], 9),
  // 360 は Dustloop の i-30e の読み方が分からないので、共通の値のまま
  named(
    {
      kind: 'rotation',
      id: 'gg-360',
      notation: '360',
      buttons: GG_BUTTONS,
      motionWindow: 40,
    },
    () => msg().rotationPlusButton,
  ),
];

/** 表記のルール。profiles.ts とサンプルの読み込みが使う（profiles.ts を読み込むと循環するため、ここに置く） */
export const SF6_RULES: NotationRules = {
  buttons: SF6_BUTTONS,
  buttonGroups: { P: PUNCH, K: KICK },
  commands: SF6_MOTIONS,
};
export const GG_RULES: NotationRules = {
  buttons: GG_BUTTONS,
  buttonGroups: {},
  commands: GG_COMMANDS,
};
