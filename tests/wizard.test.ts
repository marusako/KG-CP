import { describe, expect, it } from 'vitest';
import { ACTIONS, BUTTON_NAMES, defaultBindings, type Bindings } from '../src/input/bindings';
import { startWizard, wizardPress, wizardResult, type WizardState } from '../src/input/wizard';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const current = (): Bindings => clone(defaultBindings());

function pressAll(s: WizardState, inputs: readonly (string | number)[]): WizardState {
  return inputs.reduce((st, i) => wizardPress(st, i), s);
}

const kbInputs = ACTIONS.map((_, i) => `Key${String.fromCharCode(65 + i)}`);
const padInputs = BUTTON_NAMES.map((_, i) => 20 + i);

describe('startWizard (受け入れ条件 5)', () => {
  it('keyboard は ACTIONS を順に聞く', () => {
    const s = startWizard('keyboard');
    expect(s.target).toBe('keyboard');
    expect(s.actions).toEqual(ACTIONS);
    expect(s.index).toBe(0);
    expect(s.picked).toEqual([]);
    expect(s.error).toBeNull();
    expect(s.done).toBe(false);
  });

  it('pad は BUTTON_NAMES を順に聞く', () => {
    const s = startWizard('pad');
    expect(s.target).toBe('pad');
    expect(s.actions).toEqual(BUTTON_NAMES);
    expect(s.index).toBe(0);
    expect(s.done).toBe(false);
  });
});

describe('wizardPress / wizardResult: keyboard (受け入れ条件 5)', () => {
  it('最後まで進めると done になり、wizardResult が全操作のキーを置き換える', () => {
    let s = startWizard('keyboard');
    kbInputs.forEach((code, i) => {
      s = wizardPress(s, code);
      expect(s.index).toBe(i + 1);
      expect(s.picked).toEqual(kbInputs.slice(0, i + 1));
      expect(s.error).toBeNull();
      expect(s.done).toBe(i === kbInputs.length - 1);
    });
    const cur = current();
    const r = wizardResult(s, cur);
    ACTIONS.forEach((a, i) => expect(r.keys[a]).toBe(kbInputs[i]));
    expect(r.pad).toEqual(cur.pad);
  });

  it('wizardResult は current を書き換えない', () => {
    const s = pressAll(startWizard('keyboard'), kbInputs);
    const cur = current();
    const before = clone(cur);
    const r = wizardResult(s, cur);
    expect(cur).toEqual(before);
    expect(r).not.toBe(cur);
  });

  it('同じ入力の二度目は error になり index は進まない', () => {
    let s = wizardPress(startWizard('keyboard'), 'KeyA');
    const t = wizardPress(s, 'KeyA');
    expect(t.error).toBe('すでに 上 に使っています');
    expect(t.index).toBe(1);
    expect(t.picked).toEqual(['KeyA']);
    expect(t.done).toBe(false);
    s = t;
    // 次に正しい入力をすると error が null に戻る
    const u = wizardPress(s, 'KeyB');
    expect(u.error).toBeNull();
    expect(u.index).toBe(2);
    expect(u.picked).toEqual(['KeyA', 'KeyB']);
  });

  it('error の ◯◯ は操作の表示名（上/下/左/右、ボタンはそのまま）', () => {
    const s = pressAll(startWizard('keyboard'), kbInputs.slice(0, 5));
    expect(wizardPress(s, kbInputs[0]!).error).toBe('すでに 上 に使っています');
    expect(wizardPress(s, kbInputs[1]!).error).toBe('すでに 下 に使っています');
    expect(wizardPress(s, kbInputs[2]!).error).toBe('すでに 左 に使っています');
    expect(wizardPress(s, kbInputs[3]!).error).toBe('すでに 右 に使っています');
    expect(wizardPress(s, kbInputs[4]!).error).toBe('すでに LP に使っています');
  });

  it('Escape は受け付けない', () => {
    const s = startWizard('keyboard');
    const t = wizardPress(s, 'Escape');
    expect(t.error).toBe('Esc は取り消しに使うので割り当てられません');
    expect(t.index).toBe(0);
    expect(t.picked).toEqual([]);
    expect(t.done).toBe(false);
  });

  it('種類違い（数値）の入力は無視される', () => {
    const s = wizardPress(startWizard('keyboard'), 'KeyA');
    expect(wizardPress(s, 3)).toEqual(s);
  });

  it('done のあとの wizardPress は state を変えない', () => {
    const s = pressAll(startWizard('keyboard'), kbInputs);
    expect(s.done).toBe(true);
    expect(wizardPress(s, 'KeyZ')).toEqual(s);
    expect(wizardPress(s, 'Escape')).toEqual(s);
    expect(wizardPress(s, 1)).toEqual(s);
  });
});

describe('wizardPress / wizardResult: pad (受け入れ条件 5)', () => {
  it('最後まで進めると done になり、wizardResult が全ボタンの番号を置き換える', () => {
    let s = startWizard('pad');
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
    BUTTON_NAMES.forEach((b, i) => expect(r.pad[b]).toBe(padInputs[i]));
    expect(r.keys).toEqual(cur.keys);
    expect(cur).toEqual(before);
  });

  it('同じ入力の二度目は error になり index は進まない。次の正しい入力で error が null に戻る', () => {
    const s = wizardPress(startWizard('pad'), 0);
    const t = wizardPress(s, 0);
    expect(t.error).toBe(`すでに ${BUTTON_NAMES[0]!} に使っています`);
    expect(t.index).toBe(1);
    expect(t.picked).toEqual([0]);
    const u = wizardPress(t, 1);
    expect(u.error).toBeNull();
    expect(u.index).toBe(2);
  });

  it('12〜15（十字キー）は受け付けない', () => {
    for (const n of [12, 13, 14, 15]) {
      const t = wizardPress(startWizard('pad'), n);
      expect(t.error).toBe('十字キーは方向に使うので、ボタンには割り当てられません');
      expect(t.index).toBe(0);
      expect(t.picked).toEqual([]);
    }
  });

  it('11 と 16 は受け付ける（十字キーの範囲の外）', () => {
    for (const n of [11, 16]) {
      const t = wizardPress(startWizard('pad'), n);
      expect(t.error).toBeNull();
      expect(t.index).toBe(1);
      expect(t.picked).toEqual([n]);
    }
  });

  it('種類違い（文字列）の入力は無視される', () => {
    const s = wizardPress(startWizard('pad'), 0);
    expect(wizardPress(s, 'KeyA')).toEqual(s);
    expect(wizardPress(s, 'Escape')).toEqual(s);
  });

  it('done のあとの wizardPress は state を変えない', () => {
    const s = pressAll(startWizard('pad'), padInputs);
    expect(s.done).toBe(true);
    expect(wizardPress(s, 40)).toEqual(s);
    expect(wizardPress(s, 12)).toEqual(s);
  });
});
