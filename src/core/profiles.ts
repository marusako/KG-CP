import type { ComboRecipe } from './combo';
import { GG_COMMANDS, GG_RULES, SF6_COMMANDS, SF6_RULES } from './commands';
import type { CommandDef } from './types';
import type { NotationRules } from './notation';
import { GG_SAMPLES, SF6_SAMPLES } from './samples';

export type PlayableGameId = 'sf6' | 'ggst';

/** ゲームごとの設定（ボタン・表記・コマンド・サンプル・キーとパッドの初期値） */
export interface GameProfile extends NotationRules {
  id: PlayableGameId;
  samples: readonly ComboRecipe[];
  /** キャラなしのコマンド練習で並べる一覧（commands は表記を読むためのもので、練習の一覧ではない） */
  practiceCommands: readonly CommandDef[];
  /** 先行入力。コンボトライアルで、窓が開く何フレーム前までの早押しを成功にするか */
  inputBuffer: number;
  /** 方向（up/down/left/right）とボタンのキーの初期値（KeyboardEvent.code） */
  defaultKeys: Readonly<Record<string, string>>;
  /** ボタンのパッドの初期値（標準配置のボタン番号） */
  defaultPad: Readonly<Record<string, number>>;
}

const WASD = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' } as const;

export const PROFILES: Readonly<Record<PlayableGameId, GameProfile>> = {
  sf6: {
    ...SF6_RULES,
    id: 'sf6',
    samples: SF6_SAMPLES,
    practiceCommands: SF6_COMMANDS,
    // 有志の検証（WydD、2023 年、https://rentry.co/35ch3）の「5 通り（ちょうどの 1F と、早く押した 4F）」から。2026-11-05 確認
    inputBuffer: 4,
    defaultKeys: { ...WASD, LP: 'KeyU', MP: 'KeyI', HP: 'KeyO', LK: 'KeyJ', MK: 'KeyK', HK: 'KeyL' },
    // 標準配置: 2=X 3=Y 5=RB / 0=A 1=B 7=RT
    defaultPad: { LP: 2, MP: 3, HP: 5, LK: 0, MK: 1, HK: 7 },
  },
  ggst: {
    ...GG_RULES,
    id: 'ggst',
    samples: GG_SAMPLES,
    practiceCommands: GG_COMMANDS,
    // 公式にはフレーム数の記載が見つからない。有志のまとめ（Dustloop の翻訳。2026-10-26 更新の Notion ページ
    // https://sponge-spike-059.notion.site/6-GGST-GGST-215b1755363980189ca3caed627c08c9）で 4F。2026-11-05 確認
    inputBuffer: 4,
    defaultKeys: { ...WASD, P: 'KeyU', K: 'KeyJ', S: 'KeyI', HS: 'KeyK', D: 'KeyO' },
    // PlayStation の □=P ×=K △=S ○=HS R1=D の並び
    defaultPad: { P: 2, K: 0, S: 3, HS: 1, D: 5 },
  },
};

/** 遊べるゲームの id の一覧（PROFILES の並び）。ゲームを足すときは PROFILES だけを直せばよい */
export const PLAYABLE_GAME_IDS: readonly PlayableGameId[] = Object.keys(PROFILES) as PlayableGameId[];

/** 遊べるゲームの設定。mbtl・知らない id は undefined */
export function profileFor(id: unknown): GameProfile | undefined {
  return PLAYABLE_GAME_IDS.find((g) => g === id) !== undefined ? PROFILES[id as PlayableGameId] : undefined;
}
