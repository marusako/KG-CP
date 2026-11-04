import { describe, expect, it } from 'vitest';
import { PROFILES, profileFor } from '../src/core/profiles';
import { GG_COMMANDS, SF6_COMMANDS } from '../src/core/commands';
import { GG_SAMPLES, SF6_SAMPLES } from '../src/core/samples';
import { actionsFor } from '../src/input/bindings';

describe('PROFILES (受け入れ条件 3)', () => {
  it('sf6 は表のとおり', () => {
    const p = PROFILES.sf6;
    expect(p.id).toBe('sf6');
    expect([...p.buttons]).toEqual(['LP', 'MP', 'HP', 'LK', 'MK', 'HK']);
    expect(p.buttonGroups).toEqual({ P: ['LP', 'MP', 'HP'], K: ['LK', 'MK', 'HK'] });
    expect(p.defaultKeys).toEqual({
      up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
      LP: 'KeyU', MP: 'KeyI', HP: 'KeyO', LK: 'KeyJ', MK: 'KeyK', HK: 'KeyL',
    });
    expect(p.defaultPad).toEqual({ LP: 2, MP: 3, HP: 5, LK: 0, MK: 1, HK: 7 });
    expect(p.commands).toEqual(SF6_COMMANDS);
    expect(p.samples).toEqual(SF6_SAMPLES);
  });

  it('ggst は表のとおり（まとめ書きなし）', () => {
    const p = PROFILES.ggst;
    expect(p.id).toBe('ggst');
    expect([...p.buttons]).toEqual(['P', 'K', 'S', 'HS', 'D']);
    expect(Object.keys(p.buttonGroups)).toEqual([]);
    expect(p.defaultKeys).toEqual({
      up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
      P: 'KeyU', K: 'KeyJ', S: 'KeyI', HS: 'KeyK', D: 'KeyO',
    });
    expect(p.defaultPad).toEqual({ P: 2, K: 0, S: 3, HS: 1, D: 5 });
    expect(p.commands).toEqual(GG_COMMANDS);
    expect(p.samples).toEqual(GG_SAMPLES);
  });

  for (const id of ['sf6', 'ggst'] as const) {
    describe(`${id} の初期値`, () => {
      const p = PROFILES[id];

      it('defaultKeys は actionsFor の全部の操作を持ち、余分な操作を持たない', () => {
        expect(Object.keys(p.defaultKeys).sort()).toEqual([...actionsFor(p)].sort());
      });

      it('defaultKeys のキーが重ならない', () => {
        const codes = Object.values(p.defaultKeys);
        expect(new Set(codes).size).toBe(codes.length);
      });

      it('defaultPad はボタン全部を持ち、番号が重ならない', () => {
        expect(Object.keys(p.defaultPad).sort()).toEqual([...p.buttons].sort());
        const nums = Object.values(p.defaultPad);
        expect(new Set(nums).size).toBe(nums.length);
      });
    });
  }
});

describe('profileFor (受け入れ条件 3)', () => {
  it('sf6・ggst は PROFILES と同じ設定を返す', () => {
    expect(profileFor('sf6')).toBe(PROFILES.sf6);
    expect(profileFor('ggst')).toBe(PROFILES.ggst);
  });

  it('mbtl・知らない id・数値・null は undefined', () => {
    expect(profileFor('mbtl')).toBeUndefined();
    expect(profileFor('xx')).toBeUndefined();
    expect(profileFor(1)).toBeUndefined();
    expect(profileFor(null)).toBeUndefined();
    expect(profileFor(undefined)).toBeUndefined();
  });
});
