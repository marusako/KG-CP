import type { CommandDef, Direction, MotionStep } from './types';

const PUNCH = ['LP', 'MP', 'HP'] as const;
const KICK = ['LK', 'MK', 'HK'] as const;

// 仮の値。ゲーム別の値は後でプリセットとして入れる
const MOTION_WINDOW = 15;
const LONG_MOTION_WINDOW = 25;
const BUTTON_WINDOW = 6;

const step = (...dirs: Direction[]): MotionStep => ({ dirs });

export const DEFAULT_COMMANDS: CommandDef[] = [
  {
    kind: 'motion',
    id: '236P',
    name: '波動 (236P)',
    steps: [step(2), step(3), step(6)],
    buttons: PUNCH,
    motionWindow: MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '214P',
    name: '逆波動 (214P)',
    steps: [step(2), step(1), step(4)],
    buttons: PUNCH,
    motionWindow: MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '623P',
    name: '昇龍 (623P)',
    steps: [step(6), step(2), step(3)],
    buttons: PUNCH,
    motionWindow: MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '41236P',
    name: '半回転 (41236P)',
    steps: [step(4), step(1), step(2), step(3), step(6)],
    buttons: PUNCH,
    motionWindow: LONG_MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '63214P',
    name: '逆半回転 (63214P)',
    steps: [step(6), step(3), step(2), step(1), step(4)],
    buttons: PUNCH,
    motionWindow: LONG_MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '[4]6P',
    name: '溜め ([4]6P)',
    steps: [{ dirs: [1, 4, 7], minHold: 40 }, step(6)],
    buttons: PUNCH,
    motionWindow: MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'motion',
    id: '[2]8K',
    name: '溜め ([2]8K)',
    steps: [{ dirs: [1, 2, 3], minHold: 40 }, step(7, 8, 9)],
    buttons: KICK,
    motionWindow: MOTION_WINDOW,
    buttonWindow: BUTTON_WINDOW,
  },
  {
    kind: 'rotation',
    id: '360P',
    name: '1回転 (360P)',
    buttons: PUNCH,
    motionWindow: 40,
  },
];
