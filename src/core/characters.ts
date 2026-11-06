import { getLang, type Lang } from '../i18n/lang';
import { pick, type LocalizedText } from '../i18n/localized';
import { msg } from '../i18n/messages';
import { parseRecipe } from './combo';
import type { ComboRecipe } from './combo';
import { parseStep } from './notation';
import type { NotationRules } from './notation';
import type { PlayableGameId } from './profiles';
import type { CommandDef, FollowUpDef, PracticeDef } from './types';

// データはアプリの中に入れる。wiki をその場で読みに行かない（CORS と、サイト側のアクセス拒否のため）。
// キャラの絵や公式のアイコンは使わない（著作物のため）。確認日: 2026-11-05。

/** 'followUp' は派生の技（入力は 親~派生 か 親>派生）。コマンド練習の一覧に、派生の項目として出る */
export type MoveKind = 'special' | 'super' | 'followUp';
export interface MoveData {
  id: string;
  name: LocalizedText;
  /** 表記。複数のときは、方向が同じでボタンだけ違うもの（例: ['236S', '236HS']） */
  inputs: readonly string[];
  kind: MoveKind;
  note?: LocalizedText;
}
export interface ComboStepData {
  input: string;
  /** 前の手からのつなぎ方。最初の手は書かない */
  join?: 'link' | 'cancel';
}
export interface ComboData {
  id: string;
  name: LocalizedText;
  steps: readonly ComboStepData[];
  source: string;
}
export interface CharacterData {
  id: string;
  game: PlayableGameId;
  /** 画面に出す名前 */
  name: LocalizedText;
  moves: readonly MoveData[];
  combos: readonly ComboData[];
}

/**
 * コンボの窓。つなぎ（link）とキャンセル（cancel）ごとの、ゆるい仮の値。
 * 相手に当たってつながったかで判定できないレシピ（窓の判定になったとき）にだけ使う
 */
export const LOOSE_WINDOWS = {
  link: { min: 4, max: 20 },
  cancel: { min: 0, max: 15 },
} as const;

// キャミィ（スト6、クラシック操作）。
// 英語名の出典: kakuchopurei の技表（2023-05）。日本語名の出典: AppMedia の技表（2023-07-07）。SA2 だけは、Season 2 のパッチノート（2024-05-21、EventHubs の記事で確認）で
// K から P に変わったので P にした。
const CAMMY: CharacterData = {
  id: 'cammy',
  game: 'sf6',
  name: { en: 'Cammy', ja: 'キャミィ' },
  moves: [
    { id: 'cammy-spiral-arrow', name: { en: 'Spiral Arrow', ja: 'スパイラルアロー' }, inputs: ['236K'], kind: 'special' },
    { id: 'cammy-cannon-spike', name: { en: 'Cannon Spike', ja: 'キャノンスパイク' }, inputs: ['623K'], kind: 'special' },
    { id: 'cammy-quick-spin-knuckle', name: { en: 'Quick Spin Knuckle', ja: 'アクセルスピンナックル' }, inputs: ['214P'], kind: 'special' },
    {
      id: 'cammy-cannon-strike',
      name: { en: 'Cannon Strike', ja: 'キャノンストライク' },
      inputs: ['214K'],
      kind: 'special',
      note: { ja: '前ジャンプ中に出す技。アプリでは地上と同じに判定します', en: 'Performed during a forward jump. The app judges it the same as on the ground' },
    },
    {
      id: 'cammy-hooligan',
      name: { en: 'Hooligan Combination', ja: 'フーリガンコンビネーション' },
      inputs: ['236P'],
      kind: 'special',
      note: { ja: '派生（K・2K・LP+LK・P）は、別の項目で練習します', en: 'Practice the follow-ups (K, 2K, LP+LK, P) as separate items' },
    },
    { id: 'cammy-sa1', name: { en: 'Spin Drive Smasher', ja: 'スピンドライブスマッシャー' }, inputs: ['236236K'], kind: 'super' },
    {
      id: 'cammy-sa2',
      name: { en: 'Killer Bee Spin', ja: 'キラービースピン' },
      inputs: ['214214P'],
      kind: 'super',
      note: { ja: 'Season 2 で K から P に変わりました', en: 'Changed from K to P in Season 2' },
    },
    { id: 'cammy-sa3', name: { en: 'Delta Red Assault', ja: 'デルタレッドアサルト' }, inputs: ['236236P'], kind: 'super' },
    // 派生の技。名前は FAT の英語名で、日本語名は付けない（出典を確かめられないため。日本語でも英語名が出る）
    { id: 'cammy-swing-combination', name: { en: 'Swing Combination' }, inputs: ['5HP>HK'], kind: 'followUp' },
    { id: 'cammy-hooligan-cannon-strike', name: { en: 'Cannon Strike (Hooligan)' }, inputs: ['236P>K'], kind: 'followUp' },
    { id: 'cammy-hooligan-reverse-edge', name: { en: 'Reverse Edge' }, inputs: ['236P>2K'], kind: 'followUp' },
    { id: 'cammy-hooligan-fatal-leg-twister', name: { en: 'Fatal Leg Twister' }, inputs: ['236P>LPLK'], kind: 'followUp' },
    { id: 'cammy-hooligan-silent-step', name: { en: 'Silent Step' }, inputs: ['236P>P'], kind: 'followUp' },
  ],
  combos: [
    {
      id: 'cammy-combo-1',
      name: { en: '2LK > 2LP > 623HK' },
      steps: [{ input: '2LK' }, { input: '2LP', join: 'cancel' }, { input: '623HK', join: 'cancel' }],
      source: 'Sportskeeda のキャミィのコンボガイド',
    },
    {
      id: 'cammy-combo-2',
      name: { en: '2HP > 2MP > 236HK' },
      steps: [{ input: '2HP' }, { input: '2MP', join: 'link' }, { input: '236HK', join: 'cancel' }],
      source: 'SuperCombo wiki（検索結果の抜粋で確認）',
    },
    {
      id: 'cammy-combo-3',
      name: { en: '2MP > 214LP' },
      steps: [{ input: '2MP' }, { input: '214LP', join: 'cancel' }],
      source: 'SuperCombo wiki（検索結果の抜粋で確認）',
    },
  ],
};

// ブリジット（GG）。
// 日本語名は、確かめられる出典が見つからなかった（公式サイトのコマンド表は画像で読み取れなかった）ので ja を付けない。
// ja がないときは、日本語でも英語名を出す。ゲーム内のコマンド表などで確かめた名前を、あとで足す。
// 出典: dashfight の技表。Starship の入力は gamezo の記事（623P）。
// 日本語名: wikiwiki「ブリジット/コマンド技」（https://wikiwiki.jp/ggst-memo/ 、2026-10-01 更新、確認日 2026-11-05）。
// ストップ＆ダッシュは、同じ wiki の呼び方（236版・214版）で 2 つに分ける。
// Rock the Baby の入力は出典が食い違う。dashfight（1 か所のみ）は 632146P、FAT（2026-06 更新）と wikiwiki は 63214P。
// 2 か所が合っているので 63214P にした。
const BRIDGET: CharacterData = {
  id: 'bridget',
  game: 'ggst',
  name: { en: 'Bridget', ja: 'ブリジット' },
  moves: [
    {
      id: 'bridget-kick-start',
      name: { en: 'Kick Start My Heart', ja: 'キックスタート マイ ハート' },
      inputs: ['236K'],
      kind: 'special',
    },
    {
      id: 'bridget-roger-dive',
      name: { en: 'Roger Dive', ja: 'ロジャーダイブ' },
      inputs: ['236K'],
      kind: 'special',
      note: { ja: '空中で出す技。アプリでは地上と同じに判定します', en: 'Performed in the air. The app judges it the same as on the ground' },
    },
    {
      id: 'bridget-stop-and-dash-send',
      name: { en: 'Stop and Dash (Hit on Send)', ja: 'ストップ＆ダッシュ（236版）' },
      inputs: ['236S', '236HS'],
      kind: 'special',
    },
    {
      id: 'bridget-stop-and-dash-return',
      name: { en: 'Stop and Dash (Hit on Return)', ja: 'ストップ＆ダッシュ（214版）' },
      inputs: ['214S', '214HS'],
      kind: 'special',
    },
    {
      id: 'bridget-rolling-movement',
      name: { en: 'Rolling Movement', ja: 'ローリング移動' },
      inputs: ['214K'],
      kind: 'special',
      note: { ja: 'ヨーヨーを出しているときだけ出ます', en: 'Only usable while the yo-yo is out' },
    },
    { id: 'bridget-starship', name: { en: 'Starship', ja: 'スターシップ' }, inputs: ['623P'], kind: 'special' },
    {
      id: 'bridget-rock-the-baby',
      name: { en: 'Rock the Baby', ja: 'ロック ザ ベイビー' },
      inputs: ['63214P'],
      kind: 'special',
      note: { ja: '空中でも出せます', en: 'Can also be performed in the air' },
    },
    { id: 'bridget-loop-the-loop', name: { en: 'Loop the Loop', ja: 'ループ ザ ループ' }, inputs: ['632146S'], kind: 'super' },
    {
      id: 'bridget-killing-machine',
      name: { en: 'Return of the Killing Machine', ja: '帰ってきたキルマシーン' },
      inputs: ['632146HS'],
      kind: 'super',
    },
    // 派生の技（停止・発射）。日本語名は確かめられる出典がないので付けない
    { id: 'bridget-ksmh-brake', name: { en: 'Brake' }, inputs: ['236K~P'], kind: 'followUp' },
    { id: 'bridget-ksmh-shoot', name: { en: 'Shoot' }, inputs: ['236K~K'], kind: 'followUp' },
  ],
  combos: [
    {
      id: 'bridget-combo-1',
      name: { en: '5S > 2S > 2HS > 236K' },
      steps: [
        { input: '5S' },
        { input: '2S', join: 'cancel' },
        { input: '2HS', join: 'cancel' },
        { input: '236K', join: 'cancel' },
      ],
      // アプリは近S と遠S を分けないので 5S と書く
      source: 'Dustloop の基本ルート（c.S > 2S > 2H > 236K）',
    },
  ],
};

export const CHARACTERS: readonly CharacterData[] = [CAMMY, BRIDGET];

/** そのゲームのキャラ（CHARACTERS の順） */
export function charactersFor(game: PlayableGameId): CharacterData[] {
  return CHARACTERS.filter((c) => c.game === game);
}

/** ゲームと id が合うキャラ。ないか、id が文字列でなければ undefined */
export function findCharacter(game: PlayableGameId, id: unknown): CharacterData | undefined {
  return CHARACTERS.find((c) => c.game === game && c.id === id);
}

/**
 * 技を練習用の CommandDef にする。id は技のもの、name は「名前 (入力)」（入力が複数なら「・」でつなぐ。名前は lang の言語。日本語名がなければ英語名）。
 * 方向と猶予は表記から読んだコマンドと同じで、buttons は inputs のボタンを合わせたもの。読めなければ null（派生の技 kind 'followUp' も null。派生は moveToFollowUp）
 */
export function moveToCommand(move: MoveData, rules: NotationRules, lang: Lang = getLang()): CommandDef | null {
  let base: CommandDef | null = null;
  const buttons: string[] = [];
  for (const text of move.inputs) {
    const r = parseStep(text, rules);
    if (!r.ok || r.input.kind !== 'command') return null;
    // 入力は方向が同じものだけ（ボタンだけ違う）
    if (base !== null && base.notation !== r.input.command.notation) return null;
    base = r.input.command;
    for (const b of r.input.buttons) if (!buttons.includes(b)) buttons.push(b);
  }
  if (base === null) return null;
  // 表示していない言語の名前でも探せるよう、英語名と日本語名を検索用に持たせる
  const searchNames = move.name.ja === undefined ? [move.name.en] : [move.name.en, move.name.ja];
  const name = `${pick(move.name, lang)} (${move.inputs.join(msg(lang).inputSep)})`;
  return { ...base, id: move.id, name, buttons, searchNames };
}

/** 派生の技（kind 'followUp'）を、コマンド練習の派生の項目にする。名前は moveToCommand と同じ決め。派生の技でなければ、読めなければ null */
export function moveToFollowUp(move: MoveData, rules: NotationRules, lang: Lang = getLang()): FollowUpDef | null {
  const first = move.kind === 'followUp' ? move.inputs[0] : undefined;
  const r = first === undefined ? null : parseStep(first, rules);
  if (r === null || !r.ok || r.input.kind !== 'followUp') return null;
  const searchNames = move.name.ja === undefined ? [move.name.en] : [move.name.en, move.name.ja];
  const name = `${pick(move.name, lang)} (${move.inputs.join(msg(lang).inputSep)})`;
  return { kind: 'followUp', id: move.id, name, notation: r.input.text, buttons: r.input.follow.buttons, searchNames };
}

/** コマンド練習の一覧の項目にする（派生の技は moveToFollowUp、そのほかは moveToCommand）。読めなければ null */
export function moveToPractice(move: MoveData, rules: NotationRules, lang: Lang = getLang()): PracticeDef | null {
  return move.kind === 'followUp' ? moveToFollowUp(move, rules, lang) : moveToCommand(move, rules, lang);
}

/** コンボを ComboRecipe にする。窓は LOOSE_WINDOWS。読めなければ null */
export function comboToRecipe(combo: ComboData, rules: NotationRules): ComboRecipe | null {
  const r = parseRecipe(
    {
      id: combo.id,
      name: pick(combo.name, getLang()),
      steps: combo.steps.map((s, i) => {
        if (i === 0) return { input: s.input };
        const w = LOOSE_WINDOWS[s.join ?? 'cancel'];
        return { input: s.input, window: [w.min, w.max] };
      }),
    },
    rules,
  );
  return r.ok ? r.recipe : null;
}
