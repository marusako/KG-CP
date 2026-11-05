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
  const { id: _id, name: _name, buttons: _buttons, ...rest } = c as CommandDef & Record<string, unknown>;
  return rest;
};
function readCommand(c: CharacterData, text: string): CommandDef {
  const r = parseStep(text, rulesOf(c));
  if (!r.ok || r.input.kind !== 'command') throw new Error(`${text} がコマンドとして読めません`);
  return r.input.command;
}

const CAMMY_MOVES: [string, string, string[], 'special' | 'super'][] = [
  ['cammy-spiral-arrow', 'Spiral Arrow', ['236K'], 'special'],
  ['cammy-cannon-spike', 'Cannon Spike', ['623K'], 'special'],
  ['cammy-quick-spin-knuckle', 'Quick Spin Knuckle', ['214P'], 'special'],
  ['cammy-cannon-strike', 'Cannon Strike', ['214K'], 'special'],
  ['cammy-hooligan', 'Hooligan Combination', ['236P'], 'special'],
  ['cammy-sa1', 'Spin Drive Smasher', ['236236K'], 'super'],
  ['cammy-sa2', 'Killer Bee Assault', ['214214P'], 'super'],
  ['cammy-sa3', 'Delta Red Assault', ['236236P'], 'super'],
];
const BRIDGET_MOVES: [string, string, string[], 'special' | 'super'][] = [
  ['bridget-kick-start', 'Kick Start My Heart', ['236K'], 'special'],
  ['bridget-roger-dive', 'Roger Dive', ['236K'], 'special'],
  ['bridget-stop-and-dash-send', 'Stop and Dash（往き）', ['236S', '236HS'], 'special'],
  ['bridget-stop-and-dash-return', 'Stop and Dash（戻り）', ['214S', '214HS'], 'special'],
  ['bridget-rolling-movement', 'Rolling Movement', ['214K'], 'special'],
  ['bridget-starship', 'Starship', ['623P'], 'special'],
  ['bridget-rock-the-baby', 'Rock the Baby', ['632146P'], 'special'],
  ['bridget-loop-the-loop', 'Loop the Loop', ['632146S'], 'super'],
  ['bridget-killing-machine', 'Return of the Killing Machine', ['632146HS'], 'super'],
];

type Join = 'link' | 'cancel' | undefined;
const CAMMY_COMBOS: [string, string, [string, Join][]][] = [
  ['cammy-combo-1', '2LK > 2LP > 623HK', [['2LK', undefined], ['2LP', 'link'], ['623HK', 'cancel']]],
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
      ['cammy', 'sf6', 'キャミィ'],
      ['bridget', 'ggst', 'ブリジット'],
    ]);
  });

  const tables: [string, [string, string, string[], 'special' | 'super'][], [string, string, [string, Join][]][]][] = [
    ['cammy', CAMMY_MOVES, CAMMY_COMBOS],
    ['bridget', BRIDGET_MOVES, BRIDGET_COMBOS],
  ];
  for (const [cid, moves, combos] of tables) {
    describe(cid, () => {
      it('技の id・名前・入力・種類が表のとおり(順も同じ)', () => {
        const c = character(cid);
        expect(c.moves.map((m) => [m.id, m.name, [...m.inputs], m.kind])).toEqual(moves);
      });

      it('コンボの id・名前・手・つなぎ方が表のとおり', () => {
        const c = character(cid);
        expect(
          c.combos.map((x) => [x.id, x.name, x.steps.map((s) => [s.input, s.join])]),
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
        for (const m of c.moves) expect(moveToCommand(m, rulesOf(c)), m.id).not.toBeNull();
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
    expect(findCharacter('sf6', 'cammy')?.name).toBe('キャミィ');
    expect(findCharacter('ggst', 'bridget')?.name).toBe('ブリジット');
    expect(findCharacter('ggst', 'cammy')).toBeUndefined();
    expect(findCharacter('sf6', 'bridget')).toBeUndefined();
    expect(findCharacter('sf6', 'nobody')).toBeUndefined();
    expect(findCharacter('sf6', 1)).toBeUndefined();
    expect(findCharacter('sf6', null)).toBeUndefined();
  });
});

describe('moveToCommand (第6段階 受け入れ条件 3)', () => {
  it('Stop and Dash（往き）は buttons ["S","HS"]、方向は 236 と同じ、名前は「名前 (入力・入力)」', () => {
    const b = character('bridget');
    const c = cmdOf(b, 'bridget-stop-and-dash-send');
    expect([...c.buttons]).toEqual(['S', 'HS']);
    expect(shapeOf(c)).toEqual(shapeOf(readCommand(b, '236S')));
    expect(c.id).toBe('bridget-stop-and-dash-send');
    expect(c.name).toBe('Stop and Dash（往き） (236S・236HS)');
  });

  it('入力が 1 つなら名前は「Spiral Arrow (236K)」、id は技の id', () => {
    const c = cmdOf(character('cammy'), 'cammy-spiral-arrow');
    expect(c.id).toBe('cammy-spiral-arrow');
    expect(c.name).toBe('Spiral Arrow (236K)');
    expect([...c.buttons].sort()).toEqual(['HK', 'LK', 'MK']);
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
      for (const m of ch.moves) {
        const c = cmdOf(ch, m.id);
        expect(shapeOf(c), m.id).toEqual(shapeOf(readCommand(ch, m.inputs[0]!)));
      }
    }
  });

  it('読めない入力の技は null', () => {
    const bad: MoveData = { id: 'x', name: 'X', inputs: ['abc'], kind: 'special' };
    expect(moveToCommand(bad, PROFILES.sf6)).toBeNull();
  });

  it('ゲームに合わないボタンの入力は null (GG のルールで 236K は読めるが、236LP は読めない)', () => {
    const bad: MoveData = { id: 'x', name: 'X', inputs: ['236LP'], kind: 'special' };
    expect(moveToCommand(bad, PROFILES.ggst)).toBeNull();
  });
});

describe('comboToRecipe (第6段階 受け入れ条件 4)', () => {
  it('LOOSE_WINDOWS は つなぎ [4,20]・キャンセル [0,15]', () => {
    expect(LOOSE_WINDOWS).toEqual({ link: { min: 4, max: 20 }, cancel: { min: 0, max: 15 } });
  });

  it('cammy-combo-1: 最初の手は窓なし、つなぎ [4,20]、キャンセル [0,15]', () => {
    const c = character('cammy');
    const r = comboToRecipe(c.combos[0]!, PROFILES.sf6);
    expect(r).not.toBeNull();
    expect(r!.id).toBe('cammy-combo-1');
    expect(r!.name).toBe('2LK > 2LP > 623HK');
    expect(r!.steps.map((s) => [s.text, s.window])).toEqual([
      ['2LK', null],
      ['2LP', { min: 4, max: 20 }],
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
    const bad = { id: 'x', name: 'X', source: 's', steps: [{ input: '5S' }, { input: 'abc', join: 'cancel' as const }] };
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
    const mixed: MoveData = { id: 'x', name: 'X', inputs: ['236S', '214S'], kind: 'special' };
    expect(moveToCommand(mixed, PROFILES.ggst)).toBeNull();
  });

  it('注記: Kick Start My Heart には派生の注記がある', () => {
    expect(move(character('bridget'), 'bridget-kick-start').note).toBeTruthy();
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
