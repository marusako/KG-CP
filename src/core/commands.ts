import type { NotationRules } from './notation';
import type { CommandDef, Direction, MotionStep } from './types';

const PUNCH = ['LP', 'MP', 'HP'] as const;
const KICK = ['LK', 'MK', 'HK'] as const;

// 仮の値。motionWindow は出典が見つからず、スト6 も GG も共通の値を使う。
// BUTTON_WINDOW は GG の値で、これも仮（スト6 の一部は下の SF6_BUTTON_WINDOW）
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

export const SF6_COMMANDS: CommandDef[] = [
  {
    kind: 'motion',
    id: '236P',
    name: '波動 (236P)',
    notation: '236',
    steps: [step(2), step(3), step(6)],
    buttons: PUNCH,
    motionWindow: MOTION_WINDOW,
    buttonWindow: SF6_BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '214P',
    name: '逆波動 (214P)',
    notation: '214',
    steps: [step(2), step(1), step(4)],
    buttons: PUNCH,
    motionWindow: MOTION_WINDOW,
    buttonWindow: SF6_BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '623P',
    name: '昇龍 (623P)',
    notation: '623',
    steps: [step(6), step(2), step(3)],
    buttons: PUNCH,
    motionWindow: MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '41236P',
    name: '半回転 (41236P)',
    notation: '41236',
    steps: [step(4), step(1), step(2), step(3), step(6)],
    buttons: PUNCH,
    motionWindow: LONG_MOTION_WINDOW,
    buttonWindow: SF6_BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '63214P',
    name: '逆半回転 (63214P)',
    notation: '63214',
    steps: [step(6), step(3), step(2), step(1), step(4)],
    buttons: PUNCH,
    motionWindow: LONG_MOTION_WINDOW,
    buttonWindow: SF6_BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '[4]6P',
    name: '溜め ([4]6P)',
    notation: '[4]6',
    steps: [{ dirs: [1, 4, 7], minHold: 40 }, step(6)],
    buttons: PUNCH,
    motionWindow: MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '[2]8K',
    name: '溜め ([2]8K)',
    notation: '[2]8',
    steps: [{ dirs: [1, 2, 3], minHold: 40 }, step(7, 8, 9)],
    buttons: KICK,
    motionWindow: MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'rotation',
    id: '360P',
    name: '1回転 (360P)',
    notation: '360',
    buttons: PUNCH,
    motionWindow: 40,
  },
];

const GG_BUTTONS = ['P', 'K', 'S', 'HS', 'D'] as const;

/** GG のコマンド 1 つ。猶予は共通の値 */
const ggMotion = (notation: string, name: string, steps: readonly MotionStep[], motionWindow: number): CommandDef => ({
  kind: 'motion',
  id: `gg-${notation}`,
  notation,
  name,
  steps,
  buttons: GG_BUTTONS,
  motionWindow,
  buttonWindow: BUTTON_WINDOW,
});

export const GG_COMMANDS: CommandDef[] = [
  ggMotion('236', '236 + ボタン', [step(2), step(3), step(6)], MOTION_WINDOW),
  ggMotion('214', '214 + ボタン', [step(2), step(1), step(4)], MOTION_WINDOW),
  ggMotion('623', '623 + ボタン', [step(6), step(2), step(3)], MOTION_WINDOW),
  ggMotion('41236', '41236 + ボタン', [step(4), step(1), step(2), step(3), step(6)], LONG_MOTION_WINDOW),
  ggMotion('63214', '63214 + ボタン', [step(6), step(3), step(2), step(1), step(4)], LONG_MOTION_WINDOW),
  ggMotion('632146', '632146 + ボタン', [step(6), step(3), step(2), step(1), step(4), step(6)], LONG_MOTION_WINDOW),
  ggMotion('236236', '236236 + ボタン', [step(2), step(3), step(6), step(2), step(3), step(6)], LONG_MOTION_WINDOW),
  ggMotion('214214', '214214 + ボタン', [step(2), step(1), step(4), step(2), step(1), step(4)], LONG_MOTION_WINDOW),
  ggMotion('[4]6', '溜め [4]6 + ボタン', [{ dirs: [1, 4, 7], minHold: 40 }, step(6)], MOTION_WINDOW),
  {
    kind: 'rotation',
    id: 'gg-360',
    notation: '360',
    name: '1回転 + ボタン',
    buttons: GG_BUTTONS,
    motionWindow: 40,
  },
];

/** 表記のルール。profiles.ts とサンプルの読み込みが使う（profiles.ts を読み込むと循環するため、ここに置く） */
export const SF6_RULES: NotationRules = {
  buttons: ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'],
  buttonGroups: { P: PUNCH, K: KICK },
  commands: SF6_COMMANDS,
};
export const GG_RULES: NotationRules = {
  buttons: GG_BUTTONS,
  buttonGroups: {},
  commands: GG_COMMANDS,
};
