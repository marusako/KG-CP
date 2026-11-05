// 技のフレームデータ。アプリの中に数字を入れる（外から読みに行かない）。
//
// 出典: FAT（Frame Assistant Tool）の公開データ。https://github.com/D4RKONION/FAT の `src/js/constants/framedata/`。
// 更新日: スト6 は 2026-10-22、GG は 2026-06-14。確認日: 2026-11-05。
// FAT は GPL-3.0 なので、ファイルは写していない。使う技の数字（フレーム数は事実の情報という考え。法的な判断ではない）だけを手で書いた。
//
// 数え方: FAT の「発生（startup）」は持続の 1 フレーム目を含む。全体 = 発生 + 持続 + 硬直 − 1。
// このアプリは「発生前（発生 − 1）」「持続」「硬直」の 3 つで持つ。すると全体 = 発生前 + 持続 + 硬直 になり、
// 下の技はすべて FAT の全体と一致する（FAT の全体は tests/frameData.test.ts に書いて確かめている）。
//
// 読み替え:
// - 括弧つきの硬直（キャミィ 5HK の `19(21)`、2MP の `14(17)`）は、FAT の補足に「空振りのときの硬直」とある。
//   硬直（recovery）は括弧の中（空振り）の値。外の値（当たったとき）は contactRecovery に書く
// - 持続が途中で切れるもの（キャミィ 236HK の `3(1)12`）は、まとめて 1 つの持続にする
// - キャミィ 623 系の硬直 `24+16` は足す。「着地まで + 着地」という読み方は推測（FAT に説明はない）。
//   多段の持続（SA1 の `4*3*3*3*3`、ブリジット 2S・2HS）も足す
// - ブリジットの 5S は、このアプリが近S と遠S を分けないので近S（c.S）の値。5HS・2HS は FAT の 5H・2H
// - ブリジットの 5D は溜めない場合（発生 `20~[28]` の 20。FAT の補足に「[ ] は溜めきったときの値」とある）。
//   632146S の発生 `9+2` は足して 11 とする（`+2` の意味は FAT に書かれていない。推測）
// - ブリジットのジャンプの空中は、全体 41 − 跳ぶ前 4 − 着地 6 = 31（推測。全体に着地が入るかは書かれていない）
//
// 有利フレーム（onHit・onBlock）: FAT の onHit・onBlock の数字を手で写す。確認日は同じ 2026-11-05。
// - 括弧つき（キャミィ 236 系の `-24(-22)` や、236236K・214214P・236236P のガードなど）は条件で数字が変わり、1 つに決まらないので入れない
// - ダウンする技は FAT に `KD +38` のようにダウン後の有利だけがある。HKD（ハードダウン）も同じダウンとして { knockdown } にする
// - 数字がなく KD・HKD だけの技（ブリジットの 2D・623P・632146S のヒット）は入れない
// - ブリジットの 5D は溜めない場合の値（`0[KD]`・`-15[-10]` の括弧の外）
// - ブリジット 236S・236HS は飛び道具で、持続の 1 フレーム目に当たるとは限らないので入れない。63214P も数字がなく入れない
// - 相手の硬直の長さは「有利 + 持続 + 当たったときの硬直」で出す。キャミィの数字の入った技は、これが FAT の hitstun・blockstun と
//   同じになる（tests/frameData.test.ts で確かめている）。ただし 623MK・623HK のガードだけは FAT の blockstun と合わない
//   （ガードされると着地が早まる技と考えられる。推測）。GG は有利の数字から計算した長さで、実際のゲームの硬直とは違うことがある（推測）
//
// 入れない技: キャミィの Hooligan Combination（発生が決まらない）と Cannon Strike（空中技）。
// ブリジットの 214S・214HS（持続が書かれていない）、214K（発生が決まらない）、j.236K（空中技）、632146HS（数が書かれていない）

/** ヒット時の有利。数ならその場で硬直、knockdown ならダウン（ダウン後の有利） */
export type HitAdvantage = number | { readonly knockdown: number };

export interface MoveFrames {
  /** 入力。例: '5LP'、'236LK'、'236S'。複数ボタンで同じ値なら別々に書く */
  input: string;
  /** 発生前（攻撃が出る前のフレーム数） */
  startup: number;
  active: number;
  recovery: number;
  /** 当たったとき（ヒット・ガード）の硬直。空振りと違う技だけ */
  contactRecovery?: number;
  /** ヒット時の有利（FAT の onHit）。数字が 1 つに決まらない技は書かない */
  onHit?: HitAdvantage;
  /** ガード時の有利（FAT の onBlock）。同上 */
  onBlock?: number;
}

export interface FighterData {
  characterId: string;
  jump: { prejump: number; air: number; landing: number };
  moves: readonly MoveFrames[];
}

/** 有利などの足す項目は extra に書く */
const m = (
  input: string,
  startup: number,
  active: number,
  recovery: number,
  extra: Partial<Pick<MoveFrames, 'contactRecovery' | 'onHit' | 'onBlock'>> = {},
): MoveFrames => ({
  input,
  startup,
  active,
  recovery,
  ...extra,
});

const kd = (n: number): HitAdvantage => ({ knockdown: n });

/** キャミィ（スト6）。歩きの速さは画面の都合で決める（FAT の値は単位が分からないので使わない） */
const CAMMY: FighterData = {
  characterId: 'cammy',
  // FAT の stats の nJump `45 (4+38+3)`（跳ぶ前・空中・着地）
  jump: { prejump: 4, air: 38, landing: 3 },
  moves: [
    m('5LP', 3, 3, 7, { onHit: 5, onBlock: -2 }),
    m('5MP', 5, 4, 13, { onHit: 6, onBlock: -1 }),
    m('5HP', 7, 3, 20, { onHit: 2, onBlock: -3 }),
    m('5LK', 4, 3, 10, { onHit: 2, onBlock: -3 }),
    m('5MK', 7, 3, 18, { onHit: 3, onBlock: -4 }),
    m('5HK', 10, 3, 21, { contactRecovery: 19, onHit: 2, onBlock: -3 }),
    m('2LP', 3, 2, 8, { onHit: 5, onBlock: -2 }),
    m('2MP', 6, 3, 17, { contactRecovery: 14, onHit: 5, onBlock: -2 }),
    m('2HP', 9, 4, 15, { onHit: 7, onBlock: 1 }),
    m('2LK', 4, 3, 7, { onHit: 3, onBlock: -2 }),
    m('2MK', 7, 3, 18, { onHit: 1, onBlock: -5 }),
    m('2HK', 8, 3, 24, { onHit: kd(38), onBlock: -10 }),
    m('236LK', 8, 13, 21),
    m('236MK', 8, 15, 21),
    m('236HK', 14, 16, 21),
    m('623LK', 4, 12, 40, { onHit: kd(20), onBlock: -36 }),
    m('623MK', 5, 12, 41, { onHit: kd(21), onBlock: -36 }),
    m('623HK', 6, 12, 44, { onHit: kd(22), onBlock: -36 }),
    m('214LP', 20, 4, 16, { onHit: 2, onBlock: -3 }),
    m('214MP', 23, 4, 16, { onHit: 3, onBlock: -2 }),
    m('214HP', 27, 4, 17, { onHit: 5, onBlock: 3 }),
    m('236236K', 8, 16, 38, { onHit: kd(10) }),
    m('214214P', 12, 9, 37, { onHit: kd(12) }),
    m('236236P', 8, 15, 38, { onHit: kd(17) }),
  ],
};

/** ブリジット（GG） */
const BRIDGET: FighterData = {
  characterId: 'bridget',
  // FAT の stats の prejump 4f・jumpTotal 41・landingFrames 6f。空中 31 は上の読み替え（推測）
  jump: { prejump: 4, air: 31, landing: 6 },
  moves: [
    m('5P', 7, 2, 14, { onHit: -3, onBlock: -6 }),
    m('5K', 5, 5, 9, { onHit: 1, onBlock: -2 }),
    m('5S', 6, 6, 13, { onHit: 13, onBlock: 1 }),
    m('5HS', 10, 5, 29, { onHit: -14, onBlock: -17 }),
    m('5D', 19, 3, 26, { onHit: 0, onBlock: -15 }),
    m('2P', 6, 4, 9, { onHit: 0, onBlock: -3 }),
    m('2K', 4, 3, 11, { onHit: 1, onBlock: -2 }),
    m('2S', 10, 6, 20, { onHit: -6, onBlock: -9 }),
    m('2HS', 10, 11, 24, { onHit: -15, onBlock: -18 }),
    m('2D', 12, 4, 15, { onBlock: -6 }),
    m('236K', 9, 25, 9, { onHit: -17, onBlock: -20 }),
    m('236S', 14, 21, 3),
    m('236HS', 14, 21, 3),
    // スターシップ: FAT と wikiwiki のフレーム表は発生 9F。wikiwiki のコマンド技のページには「Ver2.03 で発生 10F→7F」とあり、食い違う（未確認）
    m('623P', 8, 12, 39, { onBlock: -28 }),
    // ロック ザ ベイビー: FAT は発生 27F、wikiwiki のフレーム表は 26F で食い違う（未確認）。FAT の値を使う
    m('63214P', 26, 2, 28),
    m('632146S', 10, 45, 47, { onBlock: -29 }),
  ],
};

export const FIGHTER_DATA: readonly FighterData[] = [CAMMY, BRIDGET];

/** そのキャラのフレームデータ。ないキャラ・知らない id は undefined */
export function fighterDataFor(characterId: string): FighterData | undefined {
  return FIGHTER_DATA.find((d) => d.characterId === characterId);
}

/** 技の全体のフレーム数（発生前 + 持続 + 硬直。FAT の全体と同じ） */
export function totalFrames(move: MoveFrames): number {
  return move.startup + move.active + move.recovery;
}

export type DummyMode = 'hit' | 'block';

export interface Reaction {
  kind: 'hitstun' | 'blockstun' | 'down';
  /** 相手が固まる（倒れている）フレーム数 L = 有利 + 持続 + 当たったときの硬直 */
  frames: number;
  /** 有利フレーム（FAT の数字。ダウンはダウン後の有利） */
  advantage: number;
}

/** その切り替えで技が当たったときの相手の反応。データがなければ null */
export function contactReaction(move: MoveFrames, mode: DummyMode): Reaction | null {
  const recovery = move.contactRecovery ?? move.recovery;
  if (mode === 'block') {
    if (move.onBlock === undefined) return null;
    return { kind: 'blockstun', frames: move.onBlock + move.active + recovery, advantage: move.onBlock };
  }
  const hit = move.onHit;
  if (hit === undefined) return null;
  if (typeof hit === 'number') return { kind: 'hitstun', frames: hit + move.active + recovery, advantage: hit };
  return { kind: 'down', frames: hit.knockdown + move.active + recovery, advantage: hit.knockdown };
}
