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
// - ブリジットの S は、近S（c.S、入力 'c.S'）と遠S（f.S）に分ける（第20段階）。5HS・2HS は FAT の 5H・2H
// - ブリジットの 5D は溜めない場合（発生 `20~[28]` の 20。FAT の補足に「[ ] は溜めきったときの値」とある）。
//   632146S の発生 `9+2` は足して 11 とする（`+2` の意味は FAT に書かれていない。推測）
// - ブリジットのジャンプの空中は、全体 41 − 跳ぶ前 4 − 着地 6 = 31（推測。全体に着地が入るかは書かれていない）
//
// 有利フレーム（onHit・onBlock）: FAT の onHit・onBlock の数字を手で写す。確認日は同じ 2026-11-05。
// - 括弧つき（キャミィ 236 系の `-24(-22)` や、236236K・214214P・236236P のガードなど）は条件で数字が変わり、1 つに決まらないので入れない
// - ダウンする技は FAT に `KD +38` のようにダウン後の有利だけがある。HKD（ハードダウン）も同じダウンとして { knockdown } にする
// - 数字がなく KD・HKD だけの技（ブリジットの 2D・623P・632146S のヒット）は入れない
// - ブリジットの 5D は溜めない場合の値（`0[KD]`・`-15[-10]` の括弧の外）
// - ブリジット 236S・236HS は飛び道具で、持続の 1 フレーム目に当たるとは限らないので入れない。63214P は、FAT のヒットが `HKD`（数字なし）でガードの値がないので入れない（事実）。
//   FAT の guardLevel が `T` なので、投げの技だと考えられる（推測。`T` の意味は FAT に書かれていない）
// - 相手の硬直の長さは「有利 + 持続 + 当たったときの硬直」で出す。キャミィの数字の入った技は、これが FAT の hitstun・blockstun と
//   同じになる（tests/frameData.test.ts で確かめている）。ただし 623MK・623HK のガードだけは FAT の blockstun と合わない
//   （ガードされると着地が早まる技と考えられる。推測）。GG は有利の数字から計算した長さで、実際のゲームの硬直とは違うことがある（推測）
//
// ヒットストップ・キャンセル（第14段階）: 確認日 2026-11-06。
// - スト6: FAT の `hitstop`（ヒットストップ）、`xx`（キャンセル先。`ch` チェーン・`sp` 必殺技・`su` SA）、
//   チェーンの先は `extraInfo` の「Chains into stand LP / crouch LP / crouch LK」から技の入力（5LP・2LP・2LK）を手で書く。
//   `tc`（ターゲットコンボ）は cancels でなく followUps に書く（下の「派生技」）。ヒットストップは 1 段目の値（多段は `5*5*5*5*13` の最初の 5、`12(13)` は括弧の外の 12）。
//   FAT のヒットストップは技ごとに 1 つなので、このアプリはヒットでもガードでも同じ値を使う（このアプリの決め。ガードで違うかは確かめていない）
// - GG: FAT にヒットストップの数はなく、`gatling`（ガトリング）と `xx`（`sp`・`su`）、`atkLvl`（攻撃レベル）がある。
//   ヒットストップは攻撃レベルで決まり、Dustloop の表の Lv0 = 11・Lv4 = 15 は検索結果の抜粋で確認した（ページは読み込みを断られた）。
//   Lv1 = 12・Lv2 = 13・Lv3 = 14 は 1 段ごとに 1 増えるという推測。ブリジットの 5D は溜めない場合の攻撃レベル 2。
//   ガトリングの先のうち、このアプリにない技（6P・6K・6H・f.S）と、対象外のジャンプキャンセル `j`・ダッシュキャンセル `d` は入れない
// - キャンセルの猶予の数え方は推測: 1 + hitstop + active が、FAT の `hcWinSpCa`（必殺技・CA の確認の猶予）と、
//   5LP・5HP・5LK・2LP・2MP・2MK・214 系のすべてで一致する（tests/frameData.test.ts）。FAT に数え方の説明はない。
//   チェーン・ガトリング・SA キャンセルも同じ窓にする（推測）
// - ヒットストップを持つ技は、反応のデータ（onHit か onBlock）がある技。反応のデータがなく当たらない技には入れない
//
// 派生技（第17段階）: 確認日 2026-11-06。FAT の値を手で写した。
// - 受付のうち、FAT に書かれているのはキャミィ 236P の「20〜40 フレーム目に派生を受け付ける」と、5HP の `hcWinTc`（当たってから 19F）だけ。
//   ブリジット 236K の派生（236K~P・236K~K）の受付は FAT にも検索にも見つからなかったので、236K の持続の間（10〜34 フレーム目）にした（推測）
// - ブリジット 236K~P・236K~K のヒットは FAT に数字がなく `KD` だけなので入れない（ガードだけ）。ヒットストップは GG の攻撃レベル 2 の 13（上の推測の表）
// - キャミィ 5HP>HK: 発生 13・持続 `4(12)3` は 4 + 12 + 3 を足して 19、硬直 29。ヒットストップは 1 段目の 11（FAT は `11*13`）
// - キャミィ 236P（フーリガン）は、派生を入れないとレイザーエッジスライサーが出る（FAT の補足）ので、236LP・236MP・236HP そのものの数字にする
//   （発生 50・持続 9・硬直 13、ヒット KD +48、ガード +2、ヒットストップ 13、キャンセル先 su3）。派生を入れると、そこで親の技から派生の技に切り替わる
// - キャノンストライク（236P>K）: 持続は FAT に「着地まで」とあるだけで数がないので 10（推測）。ヒット・ガードは括弧つきで 1 つに決まらないので入れない
// - リバースエッジ（236P>2K）: ヒット・ガードは括弧つきで入れない
// - ファタルレッグツイスター（236P>LP+LK）: 投げ。ヒット KD +18。硬直は `30(38)` の括弧の外
// - サイレントステップ（236P>P）: 攻撃なし。発生 20 は 236P を出してからの値で、入れたフレームからの値が FAT にないので、発生前 1・持続 1 は推測。硬直は `14(22)` の括弧の外
// - 236LP・236MP・236HP は FAT の `sp`（必殺技すべて）にあたるので、キャミィの必殺技のキャンセル先に足す（第14段階で入れなかったのは、236P がデータになかったため）
// - フーリガンの派生は 236LP・236MP・236HP のどれにも同じ 4 つを付ける。FAT は 236P でまとめて書いている（強さで軌道が違う補足があるが、位置を持たないので同じにした）
//
// 入れない技: ブリジットの 214S・214HS（持続が書かれていない）、214K（発生が決まらない）、j.236K（空中技）、632146HS（数が書かれていない）

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
  /** ヒットストップ（当たったときに、キャラと相手が止まるフレーム数）。反応のデータがある技だけ */
  hitstop?: number;
  /** キャンセルできる先の技の入力（例: ['5LP', '2LP', '2LK', '236LK', …]）。キャンセルできない技は書かない */
  cancels?: readonly string[];
  /** 派生。ない技は書かない */
  followUps?: readonly FollowUp[];
  /** 投げ。相手がガードでも当たる（反応はヒットの値を使う） */
  throw?: true;
  /** 攻撃の判定がない（サイレントステップなど）。持続の 1 フレーム目に相手に当たらない */
  noHitbox?: true;
}

export interface FollowUp {
  /** 親の技のあとに入れるもの。ボタン（例: 'P'、'HK'、'LPLK' は同時押し）と、要るなら方向（例: '2K'） */
  input: string;
  /**
   * 受付。'frames' は親の技を出したフレームを 1 として [from, to] フレーム目の間。
   * 'contact' は親の技が当たったフレームから frames フレームの間（ヒットストップを含む）。当たらなければ受け付けない
   */
  window: { kind: 'frames'; from: number; to: number } | { kind: 'contact'; frames: number };
  /** 派生の技。input は「親の入力 + 区切り + 派生の入力」（例: '236K~P'、'5HP>HK'、'236LP>K'） */
  move: MoveFrames;
}

export interface FighterData {
  characterId: string;
  jump: { prejump: number; air: number; landing: number };
  moves: readonly MoveFrames[];
}

/** 有利・ヒットストップ・キャンセル先などの足す項目は extra に書く */
const m = (
  input: string,
  startup: number,
  active: number,
  recovery: number,
  extra: Partial<Pick<MoveFrames, 'contactRecovery' | 'onHit' | 'onBlock' | 'hitstop' | 'cancels' | 'followUps' | 'throw' | 'noHitbox'>> = {},
): MoveFrames => ({
  input,
  startup,
  active,
  recovery,
  ...extra,
});

const kd = (n: number): HitAdvantage => ({ knockdown: n });

const CAMMY_CHAIN = ['5LP', '2LP', '2LK'];
const CAMMY_SPECIAL = ['236LK', '236MK', '236HK', '623LK', '623MK', '623HK', '214LP', '214MP', '214HP', '236LP', '236MP', '236HP'];
const CAMMY_SA = ['236236K', '214214P', '236236P'];
const CAMMY_TO_SPECIAL = [...CAMMY_SPECIAL, ...CAMMY_SA];

/** フーリガンの派生は、236LP・236MP・236HP のどれにも同じ（受付は 20〜40 フレーム目） */
const hooliganFollowUps = (parent: string): FollowUp[] => {
  const window = { kind: 'frames', from: 20, to: 40 } as const;
  return [
    // キャノンストライク。持続 10 は推測
    { input: 'K', window, move: m(`${parent}>K`, 12, 10, 12, { hitstop: 13 }) },
    // リバースエッジ
    { input: '2K', window, move: m(`${parent}>2K`, 17, 4, 13, { hitstop: 13 }) },
    // ファタルレッグツイスター（投げ）
    { input: 'LPLK', window, move: m(`${parent}>LPLK`, 9, 3, 30, { onHit: kd(18), throw: true }) },
    // サイレントステップ（攻撃なし）。発生前 1・持続 1 は推測
    { input: 'P', window, move: m(`${parent}>P`, 1, 1, 14, { noHitbox: true }) },
  ];
};

/** レイザーエッジスライサー（派生を入れないときに出る）の数字を親の技にする */
const hooligan = (input: string): MoveFrames =>
  m(input, 49, 9, 13, { onHit: kd(48), onBlock: 2, hitstop: 13, cancels: ['236236P'], followUps: hooliganFollowUps(input) });

/** キャミィ（スト6）。歩きの速さは画面の都合で決める（FAT の値は単位が分からないので使わない） */
const CAMMY: FighterData = {
  characterId: 'cammy',
  // FAT の stats の nJump `45 (4+38+3)`（跳ぶ前・空中・着地）
  jump: { prejump: 4, air: 38, landing: 3 },
  moves: [
    m('5LP', 3, 3, 7, { onHit: 5, onBlock: -2, hitstop: 9, cancels: [...CAMMY_CHAIN, ...CAMMY_TO_SPECIAL] }),
    m('5MP', 5, 4, 13, { onHit: 6, onBlock: -1, hitstop: 11 }),
    m('5HP', 7, 3, 20, {
      onHit: 2,
      onBlock: -3,
      hitstop: 13,
      cancels: CAMMY_TO_SPECIAL,
      // スイングコンビネーション。受付は FAT の hcWinTc（当たってから 19F）
      followUps: [
        {
          input: 'HK',
          window: { kind: 'contact', frames: 19 },
          move: m('5HP>HK', 12, 19, 29, { onHit: kd(26), onBlock: -12, hitstop: 11, cancels: CAMMY_TO_SPECIAL }),
        },
      ],
    }),
    m('5LK', 4, 3, 10, { onHit: 2, onBlock: -3, hitstop: 9, cancels: CAMMY_TO_SPECIAL }),
    m('5MK', 7, 3, 18, { onHit: 3, onBlock: -4, hitstop: 11 }),
    m('5HK', 10, 3, 21, { contactRecovery: 19, onHit: 2, onBlock: -3, hitstop: 13 }),
    m('2LP', 3, 2, 8, { onHit: 5, onBlock: -2, hitstop: 9, cancels: [...CAMMY_CHAIN, ...CAMMY_TO_SPECIAL] }),
    m('2MP', 6, 3, 17, { contactRecovery: 14, onHit: 5, onBlock: -2, hitstop: 11, cancels: CAMMY_TO_SPECIAL }),
    m('2HP', 9, 4, 15, { onHit: 7, onBlock: 1, hitstop: 13 }),
    m('2LK', 4, 3, 7, { onHit: 3, onBlock: -2, hitstop: 9, cancels: CAMMY_CHAIN }),
    m('2MK', 7, 3, 18, { onHit: 1, onBlock: -5, hitstop: 9, cancels: CAMMY_TO_SPECIAL }),
    m('2HK', 8, 3, 24, { onHit: kd(38), onBlock: -10, hitstop: 13 }),
    m('236LK', 8, 13, 21),
    m('236MK', 8, 15, 21),
    m('236HK', 14, 16, 21, { cancels: ['236236P'] }),
    hooligan('236LP'),
    hooligan('236MP'),
    hooligan('236HP'),
    m('623LK', 4, 12, 40, { onHit: kd(20), onBlock: -36, hitstop: 12, cancels: ['236236P'] }),
    m('623MK', 5, 12, 41, { onHit: kd(21), onBlock: -36, hitstop: 12, cancels: ['236236P'] }),
    m('623HK', 6, 12, 44, { onHit: kd(22), onBlock: -36, hitstop: 12, cancels: ['236236P'] }),
    m('214LP', 20, 4, 16, { onHit: 2, onBlock: -3, hitstop: 13, cancels: ['236236P'] }),
    m('214MP', 23, 4, 16, { onHit: 3, onBlock: -2, hitstop: 13, cancels: ['236236P'] }),
    m('214HP', 27, 4, 17, { onHit: 5, onBlock: 3, hitstop: 13, cancels: ['236236P'] }),
    m('236236K', 8, 16, 38, { onHit: kd(10), hitstop: 5 }),
    m('214214P', 12, 9, 37, { onHit: kd(12), hitstop: 16 }),
    m('236236P', 8, 15, 38, { onHit: kd(17), hitstop: 20 }),
  ],
};

const BRIDGET_SPECIAL = ['236K', '236S', '236HS', '623P', '63214P'];
const BRIDGET_SA = ['632146S'];
const BRIDGET_TO_SPECIAL = [...BRIDGET_SPECIAL, ...BRIDGET_SA];

/** ブリジット（GG） */
const BRIDGET: FighterData = {
  characterId: 'bridget',
  // FAT の stats の prejump 4f・jumpTotal 41・landingFrames 6f。空中 31 は上の読み替え（推測）
  jump: { prejump: 4, air: 31, landing: 6 },
  moves: [
    m('5P', 7, 2, 14, { onHit: -3, onBlock: -6, hitstop: 11, cancels: ['5P', '2P', ...BRIDGET_TO_SPECIAL] }),
    m('5K', 5, 5, 9, { onHit: 1, onBlock: -2, hitstop: 12, cancels: ['5D', '2D', ...BRIDGET_TO_SPECIAL] }),
    // 近S。f.S は FAT のガトリングにある（第20段階で足した。それまではデータになかった）
    m('c.S', 6, 6, 13, { onHit: 13, onBlock: 1, hitstop: 14, cancels: ['f.S', '2S', '5HS', '2HS', '5D', '2D', ...BRIDGET_TO_SPECIAL] }),
    // 遠S: FAT は発生 10・持続 5・硬直 18。ヒットストップ 13 は攻撃レベル 2 の推測の表の値（推測）
    m('f.S', 9, 5, 18, { onHit: -6, onBlock: -9, hitstop: 13, cancels: ['5HS', '2HS', ...BRIDGET_TO_SPECIAL] }),
    m('5HS', 10, 5, 29, { onHit: -14, onBlock: -17, hitstop: 14, cancels: BRIDGET_TO_SPECIAL }),
    m('5D', 19, 3, 26, { onHit: 0, onBlock: -15, hitstop: 13 }),
    m('2P', 6, 4, 9, { onHit: 0, onBlock: -3, hitstop: 11, cancels: ['5P', '2P', ...BRIDGET_TO_SPECIAL] }),
    m('2K', 4, 3, 11, { onHit: 1, onBlock: -2, hitstop: 12, cancels: ['5D', '2D', ...BRIDGET_TO_SPECIAL] }),
    m('2S', 10, 6, 20, { onHit: -6, onBlock: -9, hitstop: 13, cancels: ['5HS', '2HS', ...BRIDGET_TO_SPECIAL] }),
    m('2HS', 10, 11, 24, { onHit: -15, onBlock: -18, hitstop: 14, cancels: BRIDGET_TO_SPECIAL }),
    m('2D', 12, 4, 15, { onBlock: -6, hitstop: 13, cancels: BRIDGET_TO_SPECIAL }),
    m('236K', 9, 25, 9, {
      onHit: -17,
      onBlock: -20,
      hitstop: 13,
      // キックスタート マイ ハートの停止（P）・発射（K）。受付は 236K の持続の間（10〜34 フレーム目。推測）、ヒットストップ 13 は攻撃レベル 2（推測）
      followUps: [
        { input: 'P', window: { kind: 'frames', from: 10, to: 34 }, move: m('236K~P', 6, 7, 19, { onBlock: -6, hitstop: 13 }) },
        { input: 'K', window: { kind: 'frames', from: 10, to: 34 }, move: m('236K~K', 2, 20, 24, { onBlock: -33, hitstop: 13 }) },
      ],
    }),
    m('236S', 14, 21, 3),
    m('236HS', 14, 21, 3),
    // スターシップ: FAT と wikiwiki のフレーム表は発生 9F。wikiwiki のコマンド技のページには「Ver2.03 で発生 10F→7F」とあり、食い違う（未確認）
    m('623P', 8, 12, 39, { onBlock: -28, hitstop: 13 }),
    // ロック ザ ベイビー: FAT は発生 27F、wikiwiki のフレーム表は 26F で食い違う（未確認）。FAT の値を使う
    m('63214P', 26, 2, 28),
    m('632146S', 10, 45, 47, { onBlock: -29, hitstop: 13 }),
  ],
};

export const FIGHTER_DATA: readonly FighterData[] = [CAMMY, BRIDGET];

/** そのキャラのフレームデータ。ないキャラ・知らない id は undefined */
export function fighterDataFor(characterId: string): FighterData | undefined {
  return FIGHTER_DATA.find((d) => d.characterId === characterId);
}

/** 派生の技 → 親の技と派生。データの全部の派生を最初に 1 回だけ登録する */
const FOLLOW_UP_LINKS = new WeakMap<MoveFrames, { parent: MoveFrames; followUp: FollowUp }>();
for (const data of FIGHTER_DATA) {
  for (const parent of data.moves) {
    for (const followUp of parent.followUps ?? []) FOLLOW_UP_LINKS.set(followUp.move, { parent, followUp });
  }
}

/** 派生の技なら、その親の技と派生の定義。派生の技でなければ undefined */
export function followUpLink(move: MoveFrames): { parent: MoveFrames; followUp: FollowUp } | undefined {
  return FOLLOW_UP_LINKS.get(move);
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

/** その切り替えで技が当たったときの相手の反応。データがなければ null。投げは切り替えによらずヒット */
export function contactReaction(move: MoveFrames, mode: DummyMode): Reaction | null {
  // 投げは相手がガードでも当たる（ヒットの反応）
  if (move.throw === true) mode = 'hit';
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
