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
//   1 段目には相手がいなくて技はいつも空振りなので、括弧の中（空振り）の値を使う
// - 持続が途中で切れるもの（キャミィ 236HK の `3(1)12`）は、まとめて 1 つの持続にする
// - キャミィ 623 系の硬直 `24+16` は足す。「着地まで + 着地」という読み方は推測（FAT に説明はない）。
//   多段の持続（SA1 の `4*3*3*3*3`、ブリジット 2S・2HS）も足す
// - ブリジットの 5S は、このアプリが近S と遠S を分けないので近S（c.S）の値。5HS・2HS は FAT の 5H・2H
// - ブリジットの 5D は溜めない場合（発生 `20~[28]` の 20。FAT の補足に「[ ] は溜めきったときの値」とある）。
//   632146S の発生 `9+2` は足して 11 とする（`+2` の意味は FAT に書かれていない。推測）
// - ブリジットのジャンプの空中は、全体 41 − 跳ぶ前 4 − 着地 6 = 31（推測。全体に着地が入るかは書かれていない）
//
// 入れない技: キャミィの Hooligan Combination（発生が決まらない）と Cannon Strike（空中技）。
// ブリジットの 214S・214HS（持続が書かれていない）、214K（発生が決まらない）、j.236K（空中技）、632146HS（数が書かれていない）

export interface MoveFrames {
  /** 入力。例: '5LP'、'236LK'、'236S'。複数ボタンで同じ値なら別々に書く */
  input: string;
  /** 発生前（攻撃が出る前のフレーム数） */
  startup: number;
  active: number;
  recovery: number;
}

export interface FighterData {
  characterId: string;
  jump: { prejump: number; air: number; landing: number };
  moves: readonly MoveFrames[];
}

const m = (input: string, startup: number, active: number, recovery: number): MoveFrames => ({
  input,
  startup,
  active,
  recovery,
});

/** キャミィ（スト6）。歩きの速さは画面の都合で決める（FAT の値は単位が分からないので使わない） */
const CAMMY: FighterData = {
  characterId: 'cammy',
  // FAT の stats の nJump `45 (4+38+3)`（跳ぶ前・空中・着地）
  jump: { prejump: 4, air: 38, landing: 3 },
  moves: [
    m('5LP', 3, 3, 7),
    m('5MP', 5, 4, 13),
    m('5HP', 7, 3, 20),
    m('5LK', 4, 3, 10),
    m('5MK', 7, 3, 18),
    m('5HK', 10, 3, 21),
    m('2LP', 3, 2, 8),
    m('2MP', 6, 3, 17),
    m('2HP', 9, 4, 15),
    m('2LK', 4, 3, 7),
    m('2MK', 7, 3, 18),
    m('2HK', 8, 3, 24),
    m('236LK', 8, 13, 21),
    m('236MK', 8, 15, 21),
    m('236HK', 14, 16, 21),
    m('623LK', 4, 12, 40),
    m('623MK', 5, 12, 41),
    m('623HK', 6, 12, 44),
    m('214LP', 20, 4, 16),
    m('214MP', 23, 4, 16),
    m('214HP', 27, 4, 17),
    m('236236K', 8, 16, 38),
    m('214214P', 12, 9, 37),
    m('236236P', 8, 15, 38),
  ],
};

/** ブリジット（GG） */
const BRIDGET: FighterData = {
  characterId: 'bridget',
  // FAT の stats の prejump 4f・jumpTotal 41・landingFrames 6f。空中 31 は上の読み替え（推測）
  jump: { prejump: 4, air: 31, landing: 6 },
  moves: [
    m('5P', 7, 2, 14),
    m('5K', 5, 5, 9),
    m('5S', 6, 6, 13),
    m('5HS', 10, 5, 29),
    m('5D', 19, 3, 26),
    m('2P', 6, 4, 9),
    m('2K', 4, 3, 11),
    m('2S', 10, 6, 20),
    m('2HS', 10, 11, 24),
    m('2D', 12, 4, 15),
    m('236K', 9, 25, 9),
    m('236S', 14, 21, 3),
    m('236HS', 14, 21, 3),
    // スターシップ: FAT と wikiwiki のフレーム表は発生 9F。wikiwiki のコマンド技のページには「Ver2.03 で発生 10F→7F」とあり、食い違う（未確認）
    m('623P', 8, 12, 39),
    // ロック ザ ベイビー: FAT は発生 27F、wikiwiki のフレーム表は 26F で食い違う（未確認）。FAT の値を使う
    m('63214P', 26, 2, 28),
    m('632146S', 10, 45, 47),
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
