import type { ComboRecipe } from './combo';
import { GG_RULES, SF6_RULES } from './commands';
import type { NotationRules } from './notation';
import { GG_SAMPLES, SF6_SAMPLES } from './samples';

export type PlayableGameId = 'sf6' | 'ggst';

/** ゲームごとの設定（ボタン・表記・コマンド・サンプル・キーとパッドの初期値） */
export interface GameProfile extends NotationRules {
  id: PlayableGameId;
  samples: readonly ComboRecipe[];
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
    defaultKeys: { ...WASD, LP: 'KeyU', MP: 'KeyI', HP: 'KeyO', LK: 'KeyJ', MK: 'KeyK', HK: 'KeyL' },
    // 標準配置: 2=X 3=Y 5=RB / 0=A 1=B 7=RT
    defaultPad: { LP: 2, MP: 3, HP: 5, LK: 0, MK: 1, HK: 7 },
  },
  ggst: {
    ...GG_RULES,
    id: 'ggst',
    samples: GG_SAMPLES,
    defaultKeys: { ...WASD, P: 'KeyU', K: 'KeyJ', S: 'KeyI', HS: 'KeyK', D: 'KeyO' },
    // PlayStation の □=P ×=K △=S ○=HS R1=D の並び
    defaultPad: { P: 2, K: 0, S: 3, HS: 1, D: 5 },
  },
};

/** 遊べるゲームの設定。mbtl・知らない id は undefined */
export function profileFor(id: unknown): GameProfile | undefined {
  return id === 'sf6' || id === 'ggst' ? PROFILES[id] : undefined;
}
