import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  LOOSE_WINDOWS,
  charactersFor,
  comboToRecipe,
  findCharacter,
  moveToCommand,
} from '../src/core/characters';
import type { CharacterData, MoveData } from '../src/core/characters';
import { parseStep } from '../src/core/notation';
import { PROFILES } from '../src/core/profiles';
import type { CommandDef } from '../src/core/types';

const rulesOf = (c: CharacterData) => PROFILES[c.game];

function character(id: string): CharacterData {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error(`CHARACTERS に ${id} がありません`);
  return c;
}
function move(c: CharacterData, id: string): MoveData {
  const m = c.moves.find((x) => x.id === id);
  if (!m) throw new Error(`${c.id} に技 ${id} がありません`);
  return m;
}
function cmdOf(c: CharacterData, id: string): CommandDef {
  const r = moveToCommand(move(c, id), rulesOf(c));
  if (!r) throw new Error(`${id} が null です`);
  return r;
}
const shapeOf = (c: CommandDef) => {
  // searchNames（検索用の別名、第7段階のレビュー後に追加）は、方向と猶予の比べ方には関係しないので外す
  const { id: _id, name: _name, buttons: _buttons, searchNames: _searchNames, ...rest } = c as CommandDef &
    Record<string, unknown>;
  return rest;
};
function readCommand(c: CharacterData, text: string): CommandDef {
  const r = parseStep(text, rulesOf(c));
  if (!r.ok || r.input.kind !== 'command') throw new Error(`${text} がコマンドとして読めません`);
  return r.input.command;
}

type MoveRow = [string, { en: string; ja?: string }, string[], 'special' | 'super'];
// 第17段階: 派生の技（kind 'followUp'）。名前は FAT の英語名だけで、日本語名は付けない（出典を確かめられないため）
type FollowUpRow = [string, { en: string }, string[]];
const CAMMY_FOLLOW_UPS: FollowUpRow[] = [
  ['cammy-swing-combination', { en: 'Swing Combination' }, ['5HP>HK']],
  ['cammy-hooligan-cannon-strike', { en: 'Cannon Strike (Hooligan)' }, ['236P>K']],
  ['cammy-hooligan-reverse-edge', { en: 'Reverse Edge' }, ['236P>2K']],
  ['cammy-hooligan-fatal-leg-twister', { en: 'Fatal Leg Twister' }, ['236P>LPLK']],
  ['cammy-hooligan-silent-step', { en: 'Silent Step' }, ['236P>P']],
];
const BRIDGET_FOLLOW_UPS: FollowUpRow[] = [
  ['bridget-ksmh-brake', { en: 'Brake' }, ['236K~P']],
  ['bridget-ksmh-shoot', { en: 'Shoot' }, ['236K~K']],
];
const CAMMY_MOVES: MoveRow[] = [
  ['cammy-spiral-arrow', { en: 'Spiral Arrow', ja: 'スパイラルアロー' }, ['236K'], 'special'],
  ['cammy-cannon-spike', { en: 'Cannon Spike', ja: 'キャノンスパイク' }, ['623K'], 'special'],
  ['cammy-quick-spin-knuckle', { en: 'Quick Spin Knuckle', ja: 'アクセルスピンナックル' }, ['214P'], 'special'],
  ['cammy-cannon-strike', { en: 'Cannon Strike', ja: 'キャノンストライク' }, ['214K'], 'special'],
  ['cammy-hooligan', { en: 'Hooligan Combination', ja: 'フーリガンコンビネーション' }, ['236P'], 'special'],
  ['cammy-sa1', { en: 'Spin Drive Smasher', ja: 'スピンドライブスマッシャー' }, ['236236K'], 'super'],
  ['cammy-sa2', { en: 'Killer Bee Spin', ja: 'キラービースピン' }, ['214214P'], 'super'],
  ['cammy-sa3', { en: 'Delta Red Assault', ja: 'デルタレッドアサルト' }, ['236236P'], 'super'],
];
// ブリジットの日本語名は wikiwiki の「ブリジット/コマンド技」（2026-10-01 更新）。ストップ＆ダッシュは wiki の呼び方（236版・214版）で分ける
const BRIDGET_MOVES: MoveRow[] = [
  ['bridget-kick-start', { en: 'Kick Start My Heart', ja: 'キックスタート マイ ハート' }, ['236K'], 'special'],
  ['bridget-roger-dive', { en: 'Roger Dive', ja: 'ロジャーダイブ' }, ['236K'], 'special'],
  ['bridget-stop-and-dash-send', { en: 'Stop and Dash (Hit on Send)', ja: 'ストップ＆ダッシュ（236版）' }, ['236S', '236HS'], 'special'],
  ['bridget-stop-and-dash-return', { en: 'Stop and Dash (Hit on Return)', ja: 'ストップ＆ダッシュ（214版）' }, ['214S', '214HS'], 'special'],
  ['bridget-rolling-movement', { en: 'Rolling Movement', ja: 'ローリング移動' }, ['214K'], 'special'],
  ['bridget-starship', { en: 'Starship', ja: 'スターシップ' }, ['623P'], 'special'],
  ['bridget-rock-the-baby', { en: 'Rock the Baby', ja: 'ロック ザ ベイビー' }, ['63214P'], 'special'],
  ['bridget-loop-the-loop', { en: 'Loop the Loop', ja: 'ループ ザ ループ' }, ['632146S'], 'super'],
  ['bridget-killing-machine', { en: 'Return of the Killing Machine', ja: '帰ってきたキルマシーン' }, ['632146HS'], 'super'],
];

type Join = 'link' | 'cancel' | undefined;
const CAMMY_COMBOS: [string, string, [string, Join][]][] = [
  ['cammy-combo-1', '2LK > 2LP > 623HK', [['2LK', undefined], ['2LP', 'cancel'], ['623HK', 'cancel']]],
  ['cammy-combo-2', '2HP > 2MP > 236HK', [['2HP', undefined], ['2MP', 'link'], ['236HK', 'cancel']]],
  ['cammy-combo-3', '2MP > 214LP', [['2MP', undefined], ['214LP', 'cancel']]],
];
const BRIDGET_COMBOS: [string, string, [string, Join][]][] = [
  [
    'bridget-combo-1',
    '5S > 2S > 2HS > 236K',
    [['5S', undefined], ['2S', 'cancel'], ['2HS', 'cancel'], ['236K', 'cancel']],
  ],
];

describe('CHARACTERS (第6段階 受け入れ条件 2)', () => {
  it('キャラは 2 人。キャミィ(sf6)とブリジット(ggst)', () => {
    expect(CHARACTERS.map((c) => [c.id, c.game, c.name])).toEqual([
      ['cammy', 'sf6', { en: 'Cammy', ja: 'キャミィ' }],
      ['bridget', 'ggst', { en: 'Bridget', ja: 'ブリジット' }],
    ]);
  });

  const tables: [string, MoveRow[], [string, string, [string, Join][]][]][] = [
    ['cammy', CAMMY_MOVES, CAMMY_COMBOS],
    ['bridget', BRIDGET_MOVES, BRIDGET_COMBOS],
  ];
  for (const [cid, moves, combos] of tables) {
    describe(cid, () => {
      it('技の id・名前(英語と日本語)・入力・種類が表のとおり(順も同じ)', () => {
        const c = character(cid);
        expect(c.moves.filter((m) => m.kind !== 'followUp').map((m) => [m.id, m.name, [...m.inputs], m.kind])).toEqual(moves);
      });

      it('派生の技（kind followUp）の id・英語名（日本語名なし）・入力が表のとおり', () => {
        const c = character(cid);
        const rows = cid === 'cammy' ? CAMMY_FOLLOW_UPS : BRIDGET_FOLLOW_UPS;
        expect(c.moves.filter((m) => m.kind === 'followUp').map((m) => [m.id, m.name, [...m.inputs]])).toEqual(rows);
      });

      it('コンボの id・名前・手・つなぎ方が表のとおり', () => {
        const c = character(cid);
        expect(
          c.combos.map((x) => [x.id, x.name.en, x.steps.map((s) => [s.input, s.join])]),
        ).toEqual(combos.map(([id, name, steps]) => [id, name, steps.map(([i, j]) => [i, j])]));
      });

      it('コンボの最初の手は join なし、2 手目以降は join あり', () => {
        for (const combo of character(cid).combos) {
          combo.steps.forEach((s, i) => {
            if (i === 0) expect(s.join).toBeUndefined();
            else expect(['link', 'cancel']).toContain(s.join);
          });
        }
      });

      it('出典 source が空でない', () => {
        for (const combo of character(cid).combos) expect(combo.source).not.toBe('');
      });

      it('全部の技が、そのゲームのルールで null にならない', () => {
        const c = character(cid);
        for (const m of c.moves.filter((x) => x.kind !== 'followUp')) expect(moveToCommand(m, rulesOf(c)), m.id).not.toBeNull();
      });

      it('全部のコンボが、そのゲームのルールで null にならない', () => {
        const c = character(cid);
        for (const combo of c.combos) expect(comboToRecipe(combo, rulesOf(c)), combo.id).not.toBeNull();
      });
    });
  }

  it('注記: Cannon Strike・Roger Dive・Rock the Baby・Hooligan・Rolling Movement・SA2 に note がある', () => {
    expect(move(character('cammy'), 'cammy-cannon-strike').note).toBeTruthy();
    expect(move(character('cammy'), 'cammy-hooligan').note).toBeTruthy();
    expect(move(character('cammy'), 'cammy-sa2').note).toBeTruthy();
    expect(move(character('bridget'), 'bridget-roger-dive').note).toBeTruthy();
    expect(move(character('bridget'), 'bridget-rolling-movement').note).toBeTruthy();
    expect(move(character('bridget'), 'bridget-rock-the-baby').note).toBeTruthy();
  });

  it('キャミィの SA2 の英語名は Killer Bee Spin（Killer Bee Assault は誤り）', () => {
    expect(move(character('cammy'), 'cammy-sa2').name.en).toBe('Killer Bee Spin');
  });

  it('ブリジットの技名は全部 ja がある（wikiwiki で確かめた日本語名）', () => {
    for (const m of character('bridget').moves.filter((x) => x.kind !== 'followUp')) expect(m.name.ja, m.id).toBeTruthy();
  });

  it('キャミィの技名は全部 ja がある', () => {
    for (const m of character('cammy').moves.filter((x) => x.kind !== 'followUp')) expect(m.name.ja, m.id).toBeTruthy();
  });

  it('注記のある技は、ja と en の両方の注記がある', () => {
    for (const c of CHARACTERS) {
      for (const m of c.moves) {
        if (m.note === undefined) continue;
        expect(m.note.ja, `${m.id} の ja`).toBeTruthy();
        expect(m.note.en, `${m.id} の en`).toBeTruthy();
      }
    }
  });

  it('技の id は全キャラを通して重ならない', () => {
    const ids = CHARACTERS.flatMap((c) => c.moves.map((m) => m.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('charactersFor / findCharacter', () => {
  it('ゲームごとに、そのゲームのキャラだけを返す', () => {
    expect(charactersFor('sf6').map((c) => c.id)).toEqual(['cammy']);
    expect(charactersFor('ggst').map((c) => c.id)).toEqual(['bridget']);
  });

  it('findCharacter はゲームと id が合うときだけ返す', () => {
    expect(findCharacter('sf6', 'cammy')?.name).toEqual({ en: 'Cammy', ja: 'キャミィ' });
    expect(findCharacter('ggst', 'bridget')?.name).toEqual({ en: 'Bridget', ja: 'ブリジット' });
    expect(findCharacter('ggst', 'cammy')).toBeUndefined();
    expect(findCharacter('sf6', 'bridget')).toBeUndefined();
    expect(findCharacter('sf6', 'nobody')).toBeUndefined();
    expect(findCharacter('sf6', 1)).toBeUndefined();
    expect(findCharacter('sf6', null)).toBeUndefined();
  });
});

describe('moveToCommand (第6段階 受け入れ条件 3)', () => {
  it('Stop and Dash (Hit on Send) は buttons ["S","HS"]、方向は 236 と同じ、名前は「名前 (入力・入力)」', () => {
    const b = character('bridget');
    const c = cmdOf(b, 'bridget-stop-and-dash-send');
    expect([...c.buttons]).toEqual(['S', 'HS']);
    expect(shapeOf(c)).toEqual(shapeOf(readCommand(b, '236S')));
    expect(c.id).toBe('bridget-stop-and-dash-send');
    // 初めの言語は ja なので日本語名（ブリジットの日本語名は第10段階のあとに足した）
    expect(c.name).toBe('ストップ＆ダッシュ（236版） (236S・236HS)');
  });

  it('入力が 1 つなら名前は「スパイラルアロー (236K)」（初めの言語は ja）、id は技の id', () => {
    const c = cmdOf(character('cammy'), 'cammy-spiral-arrow');
    expect(c.id).toBe('cammy-spiral-arrow');
    expect(c.name).toBe('スパイラルアロー (236K)');
    expect([...c.buttons].sort()).toEqual(['HK', 'LK', 'MK']);
  });

  it('言語を渡すと名前が変わる: en は Spiral Arrow (236K)、ja は スパイラルアロー (236K)', () => {
    const c = character('cammy');
    const m = move(c, 'cammy-spiral-arrow');
    expect(moveToCommand(m, rulesOf(c), 'en')?.name).toBe('Spiral Arrow (236K)');
    expect(moveToCommand(m, rulesOf(c), 'ja')?.name).toBe('スパイラルアロー (236K)');
  });

  it('ブリジットは ja では日本語名、en では英語名: キックスタート マイ ハート / Kick Start My Heart (236K)', () => {
    const b = character('bridget');
    const m = move(b, 'bridget-kick-start');
    expect(moveToCommand(m, rulesOf(b), 'ja')?.name).toBe('キックスタート マイ ハート (236K)');
    expect(moveToCommand(m, rulesOf(b), 'en')?.name).toBe('Kick Start My Heart (236K)');
  });

  it('Cannon Spike の buttonWindow は 623 と同じ 6', () => {
    const c = cmdOf(character('cammy'), 'cammy-cannon-spike');
    expect(c).toMatchObject({ motionWindow: 15, buttonWindow: 6 });
    expect(shapeOf(c)).toEqual(shapeOf(readCommand(character('cammy'), '623K')));
  });

  it('SA1 は 236236 の方向で motionWindow 25、buttonWindow 6', () => {
    const c = cmdOf(character('cammy'), 'cammy-sa1');
    expect(c).toMatchObject({ motionWindow: 25, buttonWindow: 6 });
    expect([...c.buttons].sort()).toEqual(['HK', 'LK', 'MK']);
  });

  it('全部の技で、方向と猶予が最初の入力から読んだコマンドと同じ', () => {
    for (const ch of CHARACTERS) {
      for (const m of ch.moves.filter((x) => x.kind !== 'followUp')) {
        const c = cmdOf(ch, m.id);
        expect(shapeOf(c), m.id).toEqual(shapeOf(readCommand(ch, m.inputs[0]!)));
      }
    }
  });

  it('読めない入力の技は null', () => {
    const bad: MoveData = { id: 'x', name: { en: 'X' }, inputs: ['abc'], kind: 'special' };
    expect(moveToCommand(bad, PROFILES.sf6)).toBeNull();
  });

  it('ゲームに合わないボタンの入力は null (GG のルールで 236K は読めるが、236LP は読めない)', () => {
    const bad: MoveData = { id: 'x', name: { en: 'X' }, inputs: ['236LP'], kind: 'special' };
    expect(moveToCommand(bad, PROFILES.ggst)).toBeNull();
  });
});

describe('キャミィのコンボ 1 の join (第15段階 受け入れ条件 4)', () => {
  it('2LK → 2LP → 623HK の 2 手目（2LP）の join が cancel（2LK のヒット +3 と 2LP の発生 4 では目押しにならない）', () => {
    const combo = character('cammy').combos.find((x) => x.id === 'cammy-combo-1')!;
    expect(combo.steps.map((s) => s.input)).toEqual(['2LK', '2LP', '623HK']);
    expect(combo.steps[1]!.join).toBe('cancel');
  });

  it('キャミィのコンボ 2 の 2MP は link のまま（目押し）', () => {
    const combo = character('cammy').combos.find((x) => x.id === 'cammy-combo-2')!;
    expect(combo.steps[1]!.join).toBe('link');
  });
});

describe('comboToRecipe (第6段階 受け入れ条件 4)', () => {
  it('LOOSE_WINDOWS は つなぎ [4,20]・キャンセル [0,15]', () => {
    expect(LOOSE_WINDOWS).toEqual({ link: { min: 4, max: 20 }, cancel: { min: 0, max: 15 } });
  });

  it('cammy-combo-1: 最初の手は窓なし、2LP も 623HK もキャンセル [0,15]（第15段階: 2LP は目押しにならないのでチェーン）', () => {
    const c = character('cammy');
    const r = comboToRecipe(c.combos[0]!, PROFILES.sf6);
    expect(r).not.toBeNull();
    expect(r!.id).toBe('cammy-combo-1');
    expect(r!.name).toBe('2LK > 2LP > 623HK');
    expect(r!.steps.map((s) => [s.text, s.window])).toEqual([
      ['2LK', null],
      ['2LP', { min: 0, max: 15 }],
      ['623HK', { min: 0, max: 15 }],
    ]);
  });

  it('bridget-combo-1: キャンセルが 3 つ続く', () => {
    const b = character('bridget');
    const r = comboToRecipe(b.combos[0]!, PROFILES.ggst);
    expect(r!.steps.map((s) => [s.text, s.window])).toEqual([
      ['5S', null],
      ['2S', { min: 0, max: 15 }],
      ['2HS', { min: 0, max: 15 }],
      ['236K', { min: 0, max: 15 }],
    ]);
  });

  it('全部のコンボで、join と窓が対応している', () => {
    for (const ch of CHARACTERS) {
      for (const combo of ch.combos) {
        const r = comboToRecipe(combo, rulesOf(ch));
        expect(r, combo.id).not.toBeNull();
        combo.steps.forEach((s, i) => {
          const w = r!.steps[i]!.window;
          if (i === 0) expect(w).toBeNull();
          else if (s.join === 'link') expect(w).toEqual({ min: 4, max: 20 });
          else expect(w).toEqual({ min: 0, max: 15 });
        });
      }
    }
  });

  it('読めない手を含むコンボは null', () => {
    const bad = { id: 'x', name: { en: 'X' }, source: 's', steps: [{ input: '5S' }, { input: 'abc', join: 'cancel' as const }] };
    expect(comboToRecipe(bad, PROFILES.ggst)).toBeNull();
  });
});

describe('キャラを足すときの守り（第6段階 レビューの提案 D）', () => {
  it('どのキャラも、練習できる技とコンボが 1 つ以上ある（0 件だと画面が止まるため）', () => {
    for (const c of CHARACTERS) {
      const moves = c.moves.filter((m) => moveToCommand(m, rulesOf(c)) !== null);
      const combos = c.combos.filter((x) => comboToRecipe(x, rulesOf(c)) !== null);
      expect(moves.length, c.id).toBeGreaterThan(0);
      expect(combos.length, c.id).toBeGreaterThan(0);
    }
  });

  it('入力ごとに方向が違う技は null（ボタンだけ違うものしかまとめない）', () => {
    const mixed: MoveData = { id: 'x', name: { en: 'X' }, inputs: ['236S', '214S'], kind: 'special' };
    expect(moveToCommand(mixed, PROFILES.ggst)).toBeNull();
  });

  it('注記: Kick Start My Heart の注記（派生は対象外）は、派生を入れた第17段階で消えた', () => {
    expect(move(character('bridget'), 'bridget-kick-start').note).toBeUndefined();
  });

  it('各キャラに派生の技が 1 つ以上あり、入力には区切り（~ か >）がある', () => {
    for (const c of CHARACTERS) {
      const fu = c.moves.filter((m) => m.kind === 'followUp');
      expect(fu.length, c.id).toBeGreaterThan(0);
      for (const m of fu) expect(m.inputs.every((i) => /[~>]/.test(i)), m.id).toBe(true);
    }
  });

  it('注記: プランの表で注記が空の技には note がない', () => {
    const noNote = [
      'cammy-spiral-arrow', 'cammy-cannon-spike', 'cammy-quick-spin-knuckle', 'cammy-sa1', 'cammy-sa3',
      'bridget-stop-and-dash-send', 'bridget-stop-and-dash-return', 'bridget-starship',
      'bridget-loop-the-loop', 'bridget-killing-machine',
    ];
    for (const id of noNote) {
      const c = CHARACTERS.find((x) => x.moves.some((m) => m.id === id));
      expect(c, id).toBeDefined();
      expect(move(c as CharacterData, id).note, id).toBeUndefined();
    }
  });
});
