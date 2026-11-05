import { parseRecipe } from './combo';
import type { ComboRecipe } from './combo';
import { parseStep } from './notation';
import type { NotationRules } from './notation';
import type { PlayableGameId } from './profiles';
import type { CommandDef } from './types';

// データはアプリの中に入れる。wiki をその場で読みに行かない（CORS と、サイト側のアクセス拒否のため）。
// キャラの絵や公式のアイコンは使わない（著作物のため）。確認日: 2026-11-05。

export type MoveKind = 'special' | 'super';
export interface MoveData {
  id: string;
  name: string;
  /** 表記。複数のときは、方向が同じでボタンだけ違うもの（例: ['236S', '236HS']） */
  inputs: readonly string[];
  kind: MoveKind;
  note?: string;
}
export interface ComboStepData {
  input: string;
  /** 前の手からのつなぎ方。最初の手は書かない */
  join?: 'link' | 'cancel';
}
export interface ComboData {
  id: string;
  name: string;
  steps: readonly ComboStepData[];
  source: string;
}
export interface CharacterData {
  id: string;
  game: PlayableGameId;
  /** 画面に出す名前 */
  name: string;
  moves: readonly MoveData[];
  combos: readonly ComboData[];
}

/**
 * コンボの窓。つなぎ（link）とキャンセル（cancel）ごとの、ゆるい仮の値。
 * フレームデータからの正確な窓は、あとの段で扱う
 */
export const LOOSE_WINDOWS = {
  link: { min: 4, max: 20 },
  cancel: { min: 0, max: 15 },
} as const;

// キャミィ（スト6、クラシック操作）。
// 出典: kakuchopurei の技表（2023-05）。SA2 だけは、Season 2 のパッチノート（2024-05-21、EventHubs の記事で確認）で
// K から P に変わったので P にした。
const CAMMY: CharacterData = {
  id: 'cammy',
  game: 'sf6',
  name: 'キャミィ',
  moves: [
    { id: 'cammy-spiral-arrow', name: 'Spiral Arrow', inputs: ['236K'], kind: 'special' },
    { id: 'cammy-cannon-spike', name: 'Cannon Spike', inputs: ['623K'], kind: 'special' },
    { id: 'cammy-quick-spin-knuckle', name: 'Quick Spin Knuckle', inputs: ['214P'], kind: 'special' },
    {
      id: 'cammy-cannon-strike',
      name: 'Cannon Strike',
      inputs: ['214K'],
      kind: 'special',
      note: '前ジャンプ中に出す技。アプリでは地上と同じに判定します',
    },
    {
      id: 'cammy-hooligan',
      name: 'Hooligan Combination',
      inputs: ['236P'],
      kind: 'special',
      note: '派生（K など）は練習の対象外です',
    },
    { id: 'cammy-sa1', name: 'Spin Drive Smasher', inputs: ['236236K'], kind: 'super' },
    {
      id: 'cammy-sa2',
      name: 'Killer Bee Assault',
      inputs: ['214214P'],
      kind: 'super',
      note: 'Season 2 で K から P に変わりました',
    },
    { id: 'cammy-sa3', name: 'Delta Red Assault', inputs: ['236236P'], kind: 'super' },
  ],
  combos: [
    {
      id: 'cammy-combo-1',
      name: '2LK > 2LP > 623HK',
      steps: [{ input: '2LK' }, { input: '2LP', join: 'link' }, { input: '623HK', join: 'cancel' }],
      source: 'Sportskeeda のキャミィのコンボガイド',
    },
    {
      id: 'cammy-combo-2',
      name: '2HP > 2MP > 236HK',
      steps: [{ input: '2HP' }, { input: '2MP', join: 'link' }, { input: '236HK', join: 'cancel' }],
      source: 'SuperCombo wiki（検索結果の抜粋で確認）',
    },
    {
      id: 'cammy-combo-3',
      name: '2MP > 214LP',
      steps: [{ input: '2MP' }, { input: '214LP', join: 'cancel' }],
      source: 'SuperCombo wiki（検索結果の抜粋で確認）',
    },
  ],
};

// ブリジット（GG）。
// 出典: dashfight の技表。Starship の入力は gamezo の記事（623P）。Rock the Baby は dashfight だけで確認（1 か所のみ）。
const BRIDGET: CharacterData = {
  id: 'bridget',
  game: 'ggst',
  name: 'ブリジット',
  moves: [
    {
      id: 'bridget-kick-start',
      name: 'Kick Start My Heart',
      inputs: ['236K'],
      kind: 'special',
      note: '派生の Shoot（K）・Brake（P）は練習の対象外です',
    },
    {
      id: 'bridget-roger-dive',
      name: 'Roger Dive',
      inputs: ['236K'],
      kind: 'special',
      note: '空中で出す技。アプリでは地上と同じに判定します',
    },
    { id: 'bridget-stop-and-dash-send', name: 'Stop and Dash（往き）', inputs: ['236S', '236HS'], kind: 'special' },
    { id: 'bridget-stop-and-dash-return', name: 'Stop and Dash（戻り）', inputs: ['214S', '214HS'], kind: 'special' },
    {
      id: 'bridget-rolling-movement',
      name: 'Rolling Movement',
      inputs: ['214K'],
      kind: 'special',
      note: 'ヨーヨーを出しているときだけ出ます',
    },
    { id: 'bridget-starship', name: 'Starship', inputs: ['623P'], kind: 'special' },
    {
      id: 'bridget-rock-the-baby',
      name: 'Rock the Baby',
      inputs: ['632146P'],
      kind: 'special',
      note: '空中でも出せます',
    },
    { id: 'bridget-loop-the-loop', name: 'Loop the Loop', inputs: ['632146S'], kind: 'super' },
    { id: 'bridget-killing-machine', name: 'Return of the Killing Machine', inputs: ['632146HS'], kind: 'super' },
  ],
  combos: [
    {
      id: 'bridget-combo-1',
      name: '5S > 2S > 2HS > 236K',
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
 * 技を練習用の CommandDef にする。id は技のもの、name は「名前 (入力)」（入力が複数なら「・」でつなぐ）。
 * 方向と猶予は表記から読んだコマンドと同じで、buttons は inputs のボタンを合わせたもの。読めなければ null
 */
export function moveToCommand(move: MoveData, rules: NotationRules): CommandDef | null {
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
  return { ...base, id: move.id, name: `${move.name} (${move.inputs.join('・')})`, buttons };
}

/** コンボを ComboRecipe にする。窓は LOOSE_WINDOWS。読めなければ null */
export function comboToRecipe(combo: ComboData, rules: NotationRules): ComboRecipe | null {
  const r = parseRecipe(
    {
      id: combo.id,
      name: combo.name,
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
