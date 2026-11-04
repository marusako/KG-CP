import { describe, expect, it } from 'vitest';
import { actionsFor, defaultBindings, type Bindings } from '../src/input/bindings';
import { PROFILES, type GameProfile } from '../src/core/profiles';
import { actionName, startWizard, wizardPress, wizardResult, type WizardState } from '../src/input/wizard';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function pressAll(s: WizardState, inputs: readonly (string | number)[]): WizardState {
  return inputs.reduce((st, i) => wizardPress(st, i), s);
}

describe('actionName (受け入れ条件 5)', () => {
  it('方向は 上・下・左・右、ボタンは名前そのまま', () => {
    expect(actionName('up')).toBe('上');
    expect(actionName('down')).toBe('下');
    expect(actionName('left')).toBe('左');
    expect(actionName('right')).toBe('右');
    expect(actionName('LP')).toBe('LP');
    expect(actionName('HS')).toBe('HS');
  });
});

describe('startWizard: ゲームごとの順番 (受け入れ条件 5)', () => {
  it('GG のキーボードは 上・下・左・右・P・K・S・HS・D の順', () => {
    const s = startWizard('keyboard', PROFILES.ggst);
    expect(s.actions).toEqual(['up', 'down', 'left', 'right', 'P', 'K', 'S', 'HS', 'D']);
  });

  it('GG のパッドは P・K・S・HS・D の順', () => {
    const s = startWizard('pad', PROFILES.ggst);
    expect(s.actions).toEqual(['P', 'K', 'S', 'HS', 'D']);
  });

  it('SF6 のキーボードは方向 4 つのあとに LP MP HP LK MK HK、パッドは LP MP HP LK MK HK', () => {
    expect(startWizard('keyboard', PROFILES.sf6).actions).toEqual([
      'up', 'down', 'left', 'right', 'LP', 'MP', 'HP', 'LK', 'MK', 'HK',
    ]);
    expect(startWizard('pad', PROFILES.sf6).actions).toEqual(['LP', 'MP', 'HP', 'LK', 'MK', 'HK']);
  });
});

for (const profile of [PROFILES.sf6, PROFILES.ggst] as readonly GameProfile[]) {
  const actions = actionsFor(profile);
  const buttons = [...profile.buttons];
  const kbInputs = actions.map((_, i) => `Key${String.fromCharCode(65 + i)}`);
  const padInputs = buttons.map((_, i) => 20 + i);
  const current = (): Bindings => clone(defaultBindings(profile));

  describe(`startWizard (受け入れ条件 5): ${profile.id}`, () => {
    it('keyboard は actionsFor を順に聞く', () => {
      const s = startWizard('keyboard', profile);
      expect(s.target).toBe('keyboard');
      expect(s.actions).toEqual(actions);
      expect(s.index).toBe(0);
      expect(s.picked).toEqual([]);
      expect(s.error).toBeNull();
      expect(s.done).toBe(false);
    });

    it('pad は profile.buttons を順に聞く', () => {
      const s = startWizard('pad', profile);
      expect(s.target).toBe('pad');
      expect(s.actions).toEqual(buttons);
      expect(s.index).toBe(0);
      expect(s.done).toBe(false);
    });
  });

  describe(`wizardPress / wizardResult: keyboard (受け入れ条件 5): ${profile.id}`, () => {
    const start = () => startWizard('keyboard', profile);

    it('最後まで進めると done になり、wizardResult が全操作のキーを置き換える', () => {
      let s = start();
      kbInputs.forEach((code, i) => {
        s = wizardPress(s, code);
        expect(s.index).toBe(i + 1);
        expect(s.picked).toEqual(kbInputs.slice(0, i + 1));
        expect(s.error).toBeNull();
        expect(s.done).toBe(i === kbInputs.length - 1);
      });
      const cur = current();
      const r = wizardResult(s, cur);
      actions.forEach((a, i) => expect(r.keys[a]).toBe(kbInputs[i]));
      expect(r.pad).toEqual(cur.pad);
    });

    it('wizardResult は current を書き換えない', () => {
      const s = pressAll(start(), kbInputs);
      const cur = current();
      const before = clone(cur);
      const r = wizardResult(s, cur);
      expect(cur).toEqual(before);
      expect(r).not.toBe(cur);
    });

    it('同じ入力の二度目は error になり index は進まない', () => {
      const s = wizardPress(start(), 'KeyA');
      const t = wizardPress(s, 'KeyA');
      expect(t.error).toBe('すでに 上 に使っています');
      expect(t.index).toBe(1);
      expect(t.picked).toEqual(['KeyA']);
      expect(t.done).toBe(false);
      const u = wizardPress(t, 'KeyB');
      expect(u.error).toBeNull();
      expect(u.index).toBe(2);
      expect(u.picked).toEqual(['KeyA', 'KeyB']);
    });

    it('error の ◯◯ は操作の表示名（上/下/左/右、ボタンはそのまま）', () => {
      const s = pressAll(start(), kbInputs.slice(0, 5));
      expect(wizardPress(s, kbInputs[0]!).error).toBe('すでに 上 に使っています');
      expect(wizardPress(s, kbInputs[1]!).error).toBe('すでに 下 に使っています');
      expect(wizardPress(s, kbInputs[2]!).error).toBe('すでに 左 に使っています');
      expect(wizardPress(s, kbInputs[3]!).error).toBe('すでに 右 に使っています');
      expect(wizardPress(s, kbInputs[4]!).error).toBe(`すでに ${buttons[0]!} に使っています`);
    });

    it('Escape は受け付けない', () => {
      const t = wizardPress(start(), 'Escape');
      expect(t.error).toBe('Esc は取り消しに使うので割り当てられません');
      expect(t.index).toBe(0);
      expect(t.picked).toEqual([]);
      expect(t.done).toBe(false);
    });

    it('種類違い（数値）の入力は無視される', () => {
      const s = wizardPress(start(), 'KeyA');
      expect(wizardPress(s, 3)).toEqual(s);
    });

    it('done のあとの wizardPress は state を変えない', () => {
      const s = pressAll(start(), kbInputs);
      expect(s.done).toBe(true);
      expect(wizardPress(s, 'KeyZ')).toEqual(s);
      expect(wizardPress(s, 'Escape')).toEqual(s);
      expect(wizardPress(s, 1)).toEqual(s);
    });
  });

  describe(`wizardPress / wizardResult: pad (受け入れ条件 5): ${profile.id}`, () => {
    const start = () => startWizard('pad', profile);

    it('最後まで進めると done になり、wizardResult が全ボタンの番号を置き換える', () => {
      let s = start();
      padInputs.forEach((n, i) => {
        s = wizardPress(s, n);
        expect(s.index).toBe(i + 1);
        expect(s.error).toBeNull();
        expect(s.done).toBe(i === padInputs.length - 1);
      });
      expect(s.picked).toEqual(padInputs);
      const cur = current();
      const before = clone(cur);
      const r = wizardResult(s, cur);
      buttons.forEach((b, i) => expect(r.pad[b]).toBe(padInputs[i]));
      expect(r.keys).toEqual(cur.keys);
      expect(cur).toEqual(before);
    });

    it('同じ入力の二度目は error になり index は進まない。次の正しい入力で error が null に戻る', () => {
      const s = wizardPress(start(), 0);
      const t = wizardPress(s, 0);
      expect(t.error).toBe(`すでに ${buttons[0]!} に使っています`);
      expect(t.index).toBe(1);
      expect(t.picked).toEqual([0]);
      const u = wizardPress(t, 1);
      expect(u.error).toBeNull();
      expect(u.index).toBe(2);
    });

    it('12〜15（十字キー）は受け付けない', () => {
      for (const n of [12, 13, 14, 15]) {
        const t = wizardPress(start(), n);
        expect(t.error).toBe('十字キーは方向に使うので、ボタンには割り当てられません');
        expect(t.index).toBe(0);
        expect(t.picked).toEqual([]);
      }
    });

    it('11 と 16 は受け付ける（十字キーの範囲の外）', () => {
      for (const n of [11, 16]) {
        const t = wizardPress(start(), n);
        expect(t.error).toBeNull();
        expect(t.index).toBe(1);
        expect(t.picked).toEqual([n]);
      }
    });

    it('種類違い（文字列）の入力は無視される', () => {
      const s = wizardPress(start(), 0);
      expect(wizardPress(s, 'KeyA')).toEqual(s);
      expect(wizardPress(s, 'Escape')).toEqual(s);
    });

    it('done のあとの wizardPress は state を変えない', () => {
      const s = pressAll(start(), padInputs);
      expect(s.done).toBe(true);
      expect(wizardPress(s, 40)).toEqual(s);
      expect(wizardPress(s, 12)).toEqual(s);
    });
  });
}

describe('wizardResult: state.actions の分だけ上書きする (受け入れ条件 5)', () => {
  it('GG のパッドの結果は、GG のボタンだけを変え、keys は触らない', () => {
    const cur = clone(defaultBindings(PROFILES.ggst));
    const s = pressAll(startWizard('pad', PROFILES.ggst), [20, 21, 22, 23, 24]);
    const r = wizardResult(s, cur);
    expect(r.pad).toEqual({ P: 20, K: 21, S: 22, HS: 23, D: 24 });
    expect(r.keys).toEqual(cur.keys);
  });
});
