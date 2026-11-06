import type { Lang } from '../i18n/lang';
import { pick } from '../i18n/localized';
import { msg } from '../i18n/messages';
import type { CharacterData } from './characters';
import { analyzeAttempt } from './detect';
import type { FighterData, FollowUp, MoveFrames } from './frameData';
import type { NotationRules } from './notation';
import { followInputMatches, parseFollowInput, parseStep, stepInputMatches } from './notation';
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
  /**
   * 動けない間に押された技（先行入力）。動けるようになった最初のフレームで出す。
   * キャンセル先なら、ヒットストップ中は予約（cancelTo）にし、止まり終わったあとの窓ではそのフレームから出す
   */
  buffered: { move: MoveFrames; age: number } | null;
  /** いまの技が相手に当たった（付けるのは stepDummy）。新しい技を出す・動けるようになると消える。当たったあとの硬直の長さに使う */
  contact?: true;
  /** 当たったあと、このあと止まるフレーム数。stepDummy が当たったフレームに技の hitstop を入れる */
  hitstop?: number;
  /** このフレームはヒットストップで止まっていた（stepFighter が付ける。止まっていないフレームでは付けない） */
  frozen?: true;
  /** ヒットストップ中に予約したキャンセル先（か派生）の技。止まり終わった最初のフレームで出す */
  cancelTo?: MoveFrames;
  /** いまの技はキャンセルで出した（新しい技を出す・動けるようになると消える） */
  canceled?: true;
  /** cancelTo の予約は、派生を 1 つ前のフレーム（当たったフレーム）に押したもの（コンボトライアルの押したフレームを数える印） */
  followFromPrev?: true;
  /** いまの技は派生で出した（新しい技を出す・動けるようになると消える） */
  followUp?: true;
  /** 親の技が当たったフレームを 1 として、いま何フレーム目か（止まっていたフレームも数える）。contact が外れると消える。派生の受付 contact に使う */
  contactAge?: number;
}

export const INITIAL_FIGHTER: FighterState = {
  phase: 'idle',
  frame: 0,
  move: null,
  buffered: null,
};

/** キャラなしのジャンプ。キャミィ（FAT の nJump `45 (4+38+3)`）と同じ数を使う */
export const DEFAULT_JUMP = { prejump: 4, air: 38, landing: 3 } as const;

/** ジャンプ・技を出している間（動けない間）か */
function isBusy(phase: FighterPhase): boolean {
  return phase !== 'idle' && phase !== 'crouch' && phase !== 'walkForward' && phase !== 'walkBack';
}

/** 技の段階の長さ。硬直は、当たったとき（contact）に長さが違う技ならその値 */
function moveLength(move: MoveFrames, phase: 'startup' | 'active' | 'recovery', contact: boolean): number {
  if (phase === 'startup') return move.startup;
  if (phase === 'active') return move.active;
  return contact ? (move.contactRecovery ?? move.recovery) : move.recovery;
}

/** 当たり・ヒットストップ・キャンセル・派生の印（contact・contactAge・hitstop・frozen・cancelTo・canceled・followUp）を外した状態 */
function withoutHitMarks(state: FighterState): FighterState {
  const {
    contact: _contact,
    contactAge: _contactAge,
    hitstop: _hitstop,
    frozen: _frozen,
    cancelTo: _cancelTo,
    canceled: _canceled,
    followUp: _followUp,
    followFromPrev: _followFromPrev,
    ...rest
  } = state;
  return rest;
}

/** 新しい技を出す。キャンセルで出したときだけ canceled: true を付ける */
function startMove(state: FighterState, move: MoveFrames, canceled = false): FighterState {
  return {
    ...withoutHitMarks(state),
    phase: 'startup',
    frame: 0,
    move,
    buffered: null,
    ...(canceled ? { canceled: true as const } : {}),
  };
}

/** 出している技の中の位置（0 から。発生前の 0 フレーム目が 0）。ヒットストップで止まっていたフレームは進まないので数えない */
export function movePosition(state: FighterState): number {
  const move = state.move;
  if (move === null) return 0;
  if (state.phase === 'startup') return state.frame;
  if (state.phase === 'active') return move.startup + state.frame;
  return move.startup + move.active + state.frame;
}

/** 派生の受付の中か。n は親の技のフレーム番号（出したフレームを 1 とする） */
export function followWindowOpen(state: FighterState, followUp: FollowUp, n: number): boolean {
  const w = followUp.window;
  if (w.kind === 'frames') return n >= w.from && n <= w.to;
  return state.contact === true && (state.contactAge ?? 0) <= w.frames;
}

/** 新しく入れた入力に合う、いまの技の派生。同じ入力が複数に合うときは、方向つき、次に同時押しを優先する。なければ undefined */
function pickFollowUp(
  state: FighterState,
  history: readonly FrameInput[],
  rules: NotationRules,
  contactOnly = false,
): FollowUp | undefined {
  let best: { followUp: FollowUp; score: number } | undefined;
  for (const followUp of state.move?.followUps ?? []) {
    if (contactOnly && followUp.window.kind !== 'contact') continue;
    const follow = parseFollowInput(followUp.input, rules);
    if (follow === null || !followInputMatches(history, follow)) continue;
    const score = (follow.dirs !== null ? 2 : 0) + (follow.chord ? 1 : 0);
    if (best === undefined || score > best.score) best = { followUp, score };
  }
  return best?.followUp;
}

/** move が、いまの技（state.move）の派生の技か */
function isFollowUpOf(state: FighterState, move: MoveFrames | undefined): boolean {
  return move !== undefined && (state.move?.followUps?.some((f) => f.move === move) ?? false);
}

/** 派生で技を出す（startup の 0 フレーム目。canceled は付けず、followUp: true を付ける） */
function startFollowUp(state: FighterState, move: MoveFrames): FighterState {
  return { ...startMove(state, move), followUp: true };
}

/** move が、いまの技（state.move）のキャンセル先か */
function cancelsTo(state: FighterState, move: MoveFrames | undefined): move is MoveFrames {
  return move !== undefined && (state.move?.cancels?.includes(move.input) ?? false);
}

/** 動ける状態のとき、方向から次の状態を決める（同じなら state をそのまま返す） */
function freeStep(state: FighterState, dir: number): FighterState {
  if (dir >= 7) {
    return { ...state, phase: 'prejump', frame: 0, move: null, buffered: null };
  }
  if (dir === 6 || dir === 4) {
    const phase = dir === 6 ? 'walkForward' : 'walkBack';
    return { ...state, phase, frame: state.phase === phase ? state.frame + 1 : 0, move: null, buffered: null };
  }
  const phase = dir <= 3 ? 'crouch' : 'idle';
  if (state.phase === phase && state.frame === 0 && state.move === null && state.buffered === null) {
    return state;
  }
  return { ...state, phase, frame: 0, move: null, buffered: null };
}

/**
 * 1 フレーム進める。history の最後がいまのフレーム。
 * - 動ける（idle・crouch・walk）とき: 技が選ばれたら startup の 0 フレーム目へ。そうでなければ方向で idle・crouch・walk・prejump
 * - 技の途中: startup → active → recovery と進み、終わったら動ける状態へ
 * - 技の途中や着地中に選ばれた技は buffered に入れる。動けるようになるまでに age が inputBuffer を超えたら捨てる
 * - ヒットストップ（state.hitstop が 1 以上）: 段階・フレーム・技は変えず、frozen を付けて hitstop を 1 減らす。
 *   先行入力は同じように進め、残っているものがキャンセル先（move.cancels）なら cancelTo に予約する。
 *   止まり終わった最初のフレームで、予約があればその技を出す（canceled）
 * - 当たったあと（contact）、持続か硬直の 0 フレーム目になるフレームで、選ばれた技か先行入力がキャンセル先ならそのフレームから出す
 * - 派生: 技を出している間に、その技の派生の入力が新しく押され、受付（FollowUp.window）の中なら、そのフレームから派生の技を出す
 *   （startup の 0 フレーム目。followUp: true）。受付 frames は止まっていたフレームを数えない。ヒットストップ中の入力は予約（cancelTo）にして、
 *   止まり終わった最初のフレームから出す。派生は、同じフレームの先行入力・キャンセルより優先する
 * - ジャンプ: prejump → air → landing。空中ではボタンを無視する（空中技は 2 段目）
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
  // キャンセル先かを調べる（cancelsTo は型ガードなので、null を undefined にそろえた変数で渡す）
  const fresh = selected ?? undefined;

  if (!isBusy(state.phase)) {
    return selected !== null ? startMove(state, selected) : freeStep(state, dir);
  }

  // 止まっていたフレームの印は引き継がない
  if (state.frozen === true) {
    const { frozen: _frozen, ...rest } = state;
    state = rest;
  }

  // 当たってからの経過（止まっていたフレームも数える。当たったフレームが 1）
  // 当たったフレームの stepFighter は当たりを知らないので、その次のフレームで、1 つ前のフレームの派生の押し（受付 contact だけ）も拾う
  const justHit = state.contact === true && state.contactAge === undefined;
  if (state.contact === true) state = { ...state, contactAge: (state.contactAge ?? 1) + 1 };
  // 新しく入れた入力に合う派生（受付の中かは、使うところで調べる）
  const nowFollow = state.move !== null ? pickFollowUp(state, history, rules) : undefined;
  const prevFollow = nowFollow === undefined && justHit ? pickFollowUp(state, history.slice(0, -1), rules, true) : undefined;
  const follow = nowFollow ?? prevFollow;

  // 先行入力は 1 フレームごとに古くなる。新しく選ばれたものは古いものに替える
  let buffered = state.buffered === null ? null : { move: state.buffered.move, age: state.buffered.age + 1 };
  if (buffered !== null && buffered.age > inputBuffer) buffered = null;
  if (selected !== null) buffered = { move: selected, age: 0 };

  // ヒットストップ中: 止まる。キャンセル先は、新しく押したものを優先して予約にする
  if (state.hitstop !== undefined && state.hitstop >= 1) {
    const { hitstop: _hitstop, followFromPrev: _followFromPrev, ...rest } = state;
    const left = state.hitstop - 1;
    const queued = buffered?.move;
    // 止まっている間は親の技のフレームが進まないので、いまの番号（位置 + 1）で受付を見る。派生の予約は、キャンセル先より優先する
    const followNow = follow !== undefined && followWindowOpen(state, follow, movePosition(state) + 1) ? follow.move : undefined;
    const reserve =
      followNow ??
      (isFollowUpOf(state, state.cancelTo)
        ? state.cancelTo
        : cancelsTo(state, fresh)
          ? fresh
          : state.cancelTo ?? (cancelsTo(state, queued) ? queued : undefined));
    return {
      ...rest,
      frozen: true,
      buffered,
      ...(left >= 1 ? { hitstop: left } : {}),
      ...(reserve ? { cancelTo: reserve } : {}),
      ...(prevFollow !== undefined && reserve === prevFollow.move ? { followFromPrev: true as const } : state.followFromPrev === true && reserve === state.cancelTo ? { followFromPrev: true as const } : {}),
    };
  }
  if (state.cancelTo !== undefined) {
    if (follow !== undefined && followWindowOpen(state, follow, movePosition(state) + 1)) return startFollowUp(state, follow.move);
    if (isFollowUpOf(state, state.cancelTo)) return startFollowUp(state, state.cancelTo);
    return startMove(state, cancelsTo(state, fresh) ? fresh : state.cancelTo, true);
  }

  const frame = state.frame + 1;
  let next: FighterState | null = null;
  switch (state.phase) {
    case 'prejump':
      next = frame < jump.prejump ? { ...state, frame } : { ...state, phase: 'air', frame: 0 };
      break;
    case 'air':
      next = frame < jump.air ? { ...state, frame } : { ...state, phase: 'landing', frame: 0 };
      break;
    case 'landing':
      if (frame < jump.landing) next = { ...state, frame };
      break;
    case 'startup':
    case 'active':
    case 'recovery': {
      const move = state.move as MoveFrames;
      const phase = state.phase;
      if (frame < moveLength(move, phase, state.contact === true)) {
        next = { ...state, frame };
      } else if (phase === 'startup') {
        next = { ...state, phase: 'active', frame: 0 };
      } else if (phase === 'active') {
        next = { ...state, phase: 'recovery', frame: 0 };
      }
    }
  }
  if (next !== null) {
    // 派生は、先行入力・キャンセルより優先する
    if (follow !== undefined && followWindowOpen(next, follow, movePosition(next) + 1)) return startFollowUp(state, follow.move);
    // 当たったあとの、持続か硬直の 0 フレーム目: キャンセル先が選ばれていれば（先行入力に残っていれば）そこから出す
    const inWindow = next.contact === true && (next.phase === 'active' || (next.phase === 'recovery' && next.frame === 0));
    const queued = buffered?.move;
    if (inWindow && cancelsTo(state, queued)) return startMove(state, queued, true);
    return { ...next, buffered };
  }

  // 動けるようになった最初のフレーム。先行入力があれば、そのフレームが startup の 0 フレーム目
  if (buffered !== null) return startMove(state, buffered.move);
  return freeStep({ ...withoutHitMarks(state), phase: 'idle', frame: 0, move: null, buffered: null }, dir);
}

/**
 * 技の名前を、選んだ言語で「技名 (入力)」にする。
 * 必殺技・超必殺技は、キャラのデータで方向が同じで、ボタンを含む技の名前（日本語名がなければ英語名）。
 * 派生の技は、キャラのデータの派生の名前（kind 'followUp'。親と派生の入力が合うもの）。
 * 通常技は「立ち／しゃがみ」とボタン（例: 立ち弱P、Crouching MK）。どちらにも当たらなければ入力だけ
 */
export function moveDisplayName(move: MoveFrames, character: CharacterData, rules: NotationRules, lang: Lang): string {
  const r = parseStep(move.input, rules);
  if (!r.ok) return move.input;
  if (r.input.kind === 'normal') {
    const posture = move.input.startsWith('2') ? 'crouch' : 'stand';
    return `${msg(lang).normalMoveName(posture, move.input.slice(1))} (${move.input})`;
  }
  const own = r.input;
  const owner = character.moves.find((mv) =>
    mv.inputs.some((text) => {
      const p = parseStep(text, rules);
      return p.ok && stepInputMatches(move.input, own, p.input);
    }),
  );
  return owner ? `${pick(owner.name, lang)} (${move.input})` : move.input;
}
