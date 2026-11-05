import type { Lang } from '../i18n/lang';
import { pick } from '../i18n/localized';
import { msg } from '../i18n/messages';
import type { CharacterData } from './characters';
import { analyzeAttempt } from './detect';
import type { FighterData, MoveFrames } from './frameData';
import type { NotationRules } from './notation';
import { parseStep } from './notation';
import type { CommandDef, FrameInput } from './types';

/** 技の入力を読んだもの（コマンドは、技のボタンだけに絞ってある） */
interface Candidate {
  command: CommandDef;
  buttons: readonly string[];
  /** 方向の手の数。多いものから先に調べる（236236 が 236 より先） */
  steps: number;
}

/** 技を選ぶための読み取り結果。ボタンを押すたびに作り直さないよう、フレームデータごとに持つ */
interface Parsed {
  character: CharacterData;
  rules: NotationRules;
  /** そのキャラが持つコマンド（キャラの技とフレームデータの技）。方向の手が多い順 */
  candidates: readonly Candidate[];
  /** フレームデータの必殺技・超必殺技の読み取り。入力のコマンドとボタンから技を探す */
  commandMoves: readonly { move: MoveFrames; notation: string; buttons: readonly string[] }[];
}

const parsedCache = new WeakMap<FighterData, Parsed>();

function parsedFor(data: FighterData, character: CharacterData, rules: NotationRules): Parsed {
  const cached = parsedCache.get(data);
  if (cached !== undefined && cached.character === character && cached.rules === rules) return cached;
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const add = (text: string): void => {
    const r = parseStep(text, rules);
    if (!r.ok || r.input.kind !== 'command') return;
    const { command, buttons } = r.input;
    const key = `${command.notation}:${buttons.join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ command, buttons, steps: command.kind === 'motion' ? command.steps.length : 0 });
  };
  for (const mv of character.moves) mv.inputs.forEach(add);
  const commandMoves: Parsed['commandMoves'][number][] = [];
  for (const move of data.moves) {
    const r = parseStep(move.input, rules);
    if (!r.ok || r.input.kind !== 'command') continue;
    add(move.input);
    commandMoves.push({ move, notation: r.input.command.notation, buttons: r.input.buttons });
  }
  candidates.sort((a, b) => b.steps - a.steps);
  const parsed: Parsed = { character, rules, candidates, commandMoves };
  parsedCache.set(data, parsed);
  return parsed;
}

/**
 * いまのフレーム（history の最後）でボタンが新しく押されたとき、出る技を選ぶ。なければ null。
 * 必殺技・超必殺技は、表記のルール（rules）で入力を読み、analyzeAttempt が成功したものを選ぶ。
 * 並べる順（先に当たったものを選ぶ）: 方向の手が多いもの（236236 など）→ 少ないもの → 通常技。
 * コマンドが成立したのに技のデータがないとき（例: ブリジットの 214S）は、通常技に落とさず null。
 * 通常技は、いまの方向が 1・2・3 なら 2X、それ以外（4・5・6）なら 5X。7・8・9（ジャンプ）は null
 */
export function selectMove(
  history: readonly FrameInput[],
  data: FighterData,
  character: CharacterData,
  rules: NotationRules,
): MoveFrames | null {
  const cur = history[history.length - 1];
  if (cur === undefined || cur.buttons.length === 0) return null;
  const prev = history[history.length - 2];
  const fresh = cur.buttons.filter((b) => !(prev?.buttons.includes(b) ?? false));
  if (fresh.length === 0) return null;

  const parsed = parsedFor(data, character, rules);
  for (const c of parsed.candidates) {
    for (const button of fresh) {
      if (!c.buttons.includes(button)) continue;
      const r = analyzeAttempt(history, { ...c.command, buttons: [button] });
      if (r?.ok !== true) continue;
      const hit = parsed.commandMoves.find((x) => x.notation === c.command.notation && x.buttons.includes(button));
      return hit?.move ?? null;
    }
  }

  const stance = cur.dir <= 3 ? '2' : cur.dir <= 6 ? '5' : null;
  if (stance === null) return null;
  for (const button of fresh) {
    const hit = data.moves.find((mv) => mv.input === `${stance}${button}`);
    if (hit !== undefined) return hit;
  }
  return null;
}

export type FighterPhase =
  | 'idle'
  | 'crouch'
  | 'walkForward'
  | 'walkBack'
  | 'prejump'
  | 'air'
  | 'landing'
  | 'startup'
  | 'active'
  | 'recovery';

export interface FighterState {
  phase: FighterPhase;
  /** いまの段階の何フレーム目か（0 から。歩きだけは歩き始めからの通算） */
  frame: number;
  /** 出している技（startup・active・recovery のときだけ） */
  move: MoveFrames | null;
  /** 横の位置（0〜1。0.5 が真ん中） */
  x: number;
  /** ジャンプの向き（-1 後ろ、0 垂直、1 前） */
  jumpDir: -1 | 0 | 1;
  /** 動けない間に押された技（先行入力）。動けるようになった最初のフレームで出す */
  buffered: { move: MoveFrames; age: number } | null;
}

export const INITIAL_FIGHTER: FighterState = {
  phase: 'idle',
  frame: 0,
  move: null,
  x: 0.3,
  jumpDir: 0,
  buffered: null,
};

/** キャラなしのときのジャンプ（キャミィと同じ） */
/** キャラなしのジャンプ。キャミィ（FAT の nJump `45 (4+38+3)`）と同じ数を使う */
export const DEFAULT_JUMP = { prejump: 4, air: 38, landing: 3 } as const;

/** 歩きの 1 フレームの移動量と、空中の横の移動量（画面の幅に対する割合。画面の都合で決めた値） */
const WALK_SPEED = 0.004;
const AIR_SPEED = 0.006;
const X_MIN = 0.05;
const X_MAX = 0.95;

const clampX = (x: number): number => Math.min(X_MAX, Math.max(X_MIN, x));

/** ジャンプ・技を出している間（動けない間）か */
function isBusy(phase: FighterPhase): boolean {
  return phase !== 'idle' && phase !== 'crouch' && phase !== 'walkForward' && phase !== 'walkBack';
}

/** 技の段階の長さ */
function moveLength(move: MoveFrames, phase: 'startup' | 'active' | 'recovery'): number {
  return phase === 'startup' ? move.startup : phase === 'active' ? move.active : move.recovery;
}

function startMove(state: FighterState, move: MoveFrames): FighterState {
  return { ...state, phase: 'startup', frame: 0, move, jumpDir: 0, buffered: null };
}

/** 動ける状態のとき、方向から次の状態を決める（同じなら state をそのまま返す） */
function freeStep(state: FighterState, dir: number): FighterState {
  if (dir >= 7) {
    const jumpDir = dir === 7 ? -1 : dir === 9 ? 1 : 0;
    return { ...state, phase: 'prejump', frame: 0, move: null, jumpDir, buffered: null };
  }
  if (dir === 6 || dir === 4) {
    const phase = dir === 6 ? 'walkForward' : 'walkBack';
    const x = clampX(state.x + (dir === 6 ? WALK_SPEED : -WALK_SPEED));
    return { ...state, phase, frame: state.phase === phase ? state.frame + 1 : 0, move: null, x, jumpDir: 0, buffered: null };
  }
  const phase = dir <= 3 ? 'crouch' : 'idle';
  if (state.phase === phase && state.frame === 0 && state.move === null && state.jumpDir === 0 && state.buffered === null) {
    return state;
  }
  return { ...state, phase, frame: 0, move: null, jumpDir: 0, buffered: null };
}

/**
 * 1 フレーム進める。history の最後がいまのフレーム。
 * - 動ける（idle・crouch・walk）とき: 技が選ばれたら startup の 0 フレーム目へ。そうでなければ方向で idle・crouch・walk・prejump
 * - 技の途中: startup → active → recovery と進み、終わったら動ける状態へ
 * - 技の途中や着地中に選ばれた技は buffered に入れる。動けるようになるまでに age が inputBuffer を超えたら捨てる
 * - ジャンプ: prejump → air → landing。空中ではボタンを無視する（空中技は 2 段目）
 * - 歩きは 1 フレームに一定の量だけ x を動かし、0.05〜0.95 で止める
 * idle・crouch のままなら同じ state を返す（描き直しを省くため）
 */
export function stepFighter(
  state: FighterState,
  history: readonly FrameInput[],
  fighter: { data: FighterData; character: CharacterData } | null,
  rules: NotationRules,
  inputBuffer: number,
): FighterState {
  const dir = history[history.length - 1]?.dir ?? 5;
  const jump = fighter?.data.jump ?? DEFAULT_JUMP;

  // 空中・跳ぶ前はボタンを無視する
  const canAct = state.phase !== 'prejump' && state.phase !== 'air';
  const selected = fighter !== null && canAct ? selectMove(history, fighter.data, fighter.character, rules) : null;

  if (!isBusy(state.phase)) {
    return selected !== null ? startMove(state, selected) : freeStep(state, dir);
  }

  // 先行入力は 1 フレームごとに古くなる。新しく選ばれたものは古いものに替える
  let buffered = state.buffered === null ? null : { move: state.buffered.move, age: state.buffered.age + 1 };
  if (buffered !== null && buffered.age > inputBuffer) buffered = null;
  if (selected !== null) buffered = { move: selected, age: 0 };

  const frame = state.frame + 1;
  let next: FighterState | null = null;
  switch (state.phase) {
    case 'prejump':
      next = frame < jump.prejump ? { ...state, frame } : { ...state, phase: 'air', frame: 0 };
      break;
    case 'air': {
      const x = clampX(state.x + state.jumpDir * AIR_SPEED);
      next = frame < jump.air ? { ...state, frame, x } : { ...state, phase: 'landing', frame: 0, x };
      break;
    }
    case 'landing':
      if (frame < jump.landing) next = { ...state, frame };
      break;
    case 'startup':
    case 'active':
    case 'recovery': {
      const move = state.move as MoveFrames;
      const phase = state.phase;
      if (frame < moveLength(move, phase)) {
        next = { ...state, frame };
      } else if (phase === 'startup') {
        next = { ...state, phase: 'active', frame: 0 };
      } else if (phase === 'active') {
        next = { ...state, phase: 'recovery', frame: 0 };
      }
    }
  }
  if (next !== null) return { ...next, buffered };

  // 動けるようになった最初のフレーム。先行入力があれば、そのフレームが startup の 0 フレーム目
  if (buffered !== null) return startMove(state, buffered.move);
  return freeStep({ ...state, phase: 'idle', frame: 0, move: null, jumpDir: 0, buffered: null }, dir);
}

/**
 * 技の名前を、選んだ言語で「技名 (入力)」にする。
 * 必殺技・超必殺技は、キャラのデータで方向が同じで、ボタンを含む技の名前（日本語名がなければ英語名）。
 * 通常技は「立ち／しゃがみ」とボタン（例: 立ち弱P、Crouching MK）。どちらにも当たらなければ入力だけ
 */
export function moveDisplayName(move: MoveFrames, character: CharacterData, rules: NotationRules, lang: Lang): string {
  const r = parseStep(move.input, rules);
  if (!r.ok) return move.input;
  if (r.input.kind === 'normal') {
    const posture = move.input.startsWith('2') ? 'crouch' : 'stand';
    return `${msg(lang).normalMoveName(posture, move.input.slice(1))} (${move.input})`;
  }
  const { command, buttons } = r.input;
  const owner = character.moves.find((mv) =>
    mv.inputs.some((text) => {
      const p = parseStep(text, rules);
      if (!p.ok || p.input.kind !== 'command') return false;
      const own = p.input.buttons;
      return p.input.command.notation === command.notation && buttons.every((b) => own.includes(b));
    }),
  );
  return owner ? `${pick(owner.name, lang)} (${move.input})` : move.input;
}
