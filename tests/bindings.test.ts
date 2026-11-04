import { describe, expect, it } from 'vitest';
import {
  DIRECTION_NAMES,
  actionsFor,
  assignKey,
  assignPad,
  defaultBindings,
  parseBindings,
} from '../src/input/bindings';
import { PROFILES } from '../src/core/profiles';

const profiles = [PROFILES.sf6, PROFILES.ggst] as const;

describe('actionsFor / defaultBindings (受け入れ条件 4)', () => {
  it('方向 4 つのあとにゲームのボタンが並ぶ', () => {
    expect(actionsFor(PROFILES.sf6)).toEqual(['up', 'down', 'left', 'right', 'LP', 'MP', 'HP', 'LK', 'MK', 'HK']);
    expect(actionsFor(PROFILES.ggst)).toEqual(['up', 'down', 'left', 'right', 'P', 'K', 'S', 'HS', 'D']);
    expect(DIRECTION_NAMES).toEqual(['up', 'down', 'left', 'right']);
  });

  for (const p of profiles) {
    it(`${p.id}: defaultBindings は profile の初期値と同じで、keys に操作全部・pad にボタン全部がある`, () => {
      const b = defaultBindings(p);
      expect(b.keys).toEqual(p.defaultKeys);
      expect(b.pad).toEqual(p.defaultPad);
      expect(Object.keys(b.keys).sort()).toEqual([...actionsFor(p)].sort());
      expect(Object.keys(b.pad).sort()).toEqual([...p.buttons].sort());
    });

    it(`${p.id}: defaultBindings を書き換えても初期値に響かない`, () => {
      const b = defaultBindings(p);
      b.keys['up'] = 'KeyZ';
      b.pad[p.buttons[0]!] = 99;
      expect(defaultBindings(p).keys['up']).toBe('KeyW');
      expect(defaultBindings(p).pad[p.buttons[0]!]).toBe(p.defaultPad[p.buttons[0]!]);
    });
  }
});

for (const p of profiles) {
  const [a, b, c] = p.buttons as readonly [string, string, string];

  describe(`assignKey (受け入れ条件 4): ${p.id}`, () => {
    const makeKeys = (): Record<string, string> => ({ [a]: 'KeyU', [b]: 'KeyI', [c]: 'KeyO' });

    it('他の操作が使っていないキーなら、その操作だけが変わり swappedWith は null', () => {
      const r = assignKey(makeKeys(), a, 'KeyP');
      expect(r.keys).toEqual({ [a]: 'KeyP', [b]: 'KeyI', [c]: 'KeyO' });
      expect(r.swappedWith).toBeNull();
    });

    it('別の操作が使っているキーを割り当てると、その操作に元のキーを渡して入れ替える', () => {
      const r = assignKey(makeKeys(), a, 'KeyI');
      expect(r.keys).toEqual({ [a]: 'KeyI', [b]: 'KeyU', [c]: 'KeyO' });
      expect(r.swappedWith).toBe(b);
    });

    it('入れ替え後も、同じキーを複数の操作が持たない', () => {
      const r = assignKey(makeKeys(), c, 'KeyU');
      const values = Object.values(r.keys);
      expect(new Set(values).size).toBe(values.length);
    });

    it('同じ操作に同じキーを割り当て直しても何も変わらず、swappedWith は null', () => {
      const r = assignKey(makeKeys(), b, 'KeyI');
      expect(r.keys).toEqual(makeKeys());
      expect(r.swappedWith).toBeNull();
    });

    it('引数の keys を書き換えない (通常の割り当て・入れ替えの両方)', () => {
      const keys = makeKeys();
      assignKey(keys, a, 'KeyP');
      assignKey(keys, a, 'KeyI');
      expect(keys).toEqual(makeKeys());
    });

    it('新しいオブジェクトを返す', () => {
      const keys = makeKeys();
      expect(assignKey(keys, a, 'KeyU').keys).not.toBe(keys);
    });

    it('初期値の割り当てでも、方向と入れ替えられる', () => {
      const r = assignKey(p.defaultKeys, 'up', p.defaultKeys[a]!);
      expect(r.keys['up']).toBe(p.defaultKeys[a]);
      expect(r.keys[a]).toBe(p.defaultKeys['up']);
      expect(r.swappedWith).toBe(a);
    });
  });

  describe(`assignPad (受け入れ条件 4): ${p.id}`, () => {
    const makePad = (): Record<string, number> => ({ [a]: 0, [b]: 1, [c]: 5 });

    it('他のボタンが使っていない番号なら、そのボタンだけが変わり swappedWith は null', () => {
      const r = assignPad(makePad(), a, 9);
      expect(r.pad).toEqual({ [a]: 9, [b]: 1, [c]: 5 });
      expect(r.swappedWith).toBeNull();
    });

    it('別のボタンが使っている番号を割り当てると、そのボタンに元の番号を渡して入れ替える', () => {
      const r = assignPad(makePad(), a, 1);
      expect(r.pad).toEqual({ [a]: 1, [b]: 0, [c]: 5 });
      expect(r.swappedWith).toBe(b);
    });

    it('同じボタンに同じ番号を割り当て直しても何も変わらず、swappedWith は null', () => {
      const r = assignPad(makePad(), b, 1);
      expect(r.pad).toEqual(makePad());
      expect(r.swappedWith).toBeNull();
    });

    it('番号 0 も正しく扱う (0 を使っているボタンと入れ替わる)', () => {
      const r = assignPad(makePad(), b, 0);
      expect(r.pad).toEqual({ [a]: 1, [b]: 0, [c]: 5 });
      expect(r.swappedWith).toBe(a);
    });

    it('引数の pad を書き換えない', () => {
      const pad = makePad();
      assignPad(pad, a, 9);
      assignPad(pad, a, 1);
      expect(pad).toEqual(makePad());
    });
  });

  describe(`parseBindings (受け入れ条件 4): ${p.id}`, () => {
    const defaults = () => defaultBindings(p);
    const lastButton = p.buttons[p.buttons.length - 1]!;

    it('null・壊れた JSON・配列・オブジェクトでない値は初期値', () => {
      for (const raw of [null, '{', 'abc', '[]', '[1,2]', '123', '"x"', 'null', 'true', '']) {
        expect(parseBindings(raw, p)).toEqual(defaults());
      }
    });

    it('空のオブジェクトは初期値', () => {
      expect(parseBindings('{}', p)).toEqual(defaults());
    });

    it('正しい保存内容はそのまま読む', () => {
      const saved = { keys: { ...p.defaultKeys, up: 'ArrowUp', [a]: 'KeyQ' }, pad: { ...p.defaultPad, [a]: 9 } };
      expect(parseBindings(JSON.stringify(saved), p)).toEqual(saved);
    });

    it('keys が配列・pad が文字列などでも、その部分は初期値', () => {
      expect(parseBindings(JSON.stringify({ keys: [], pad: 'x' }), p)).toEqual(defaults());
    });

    it('おかしい操作だけ初期値に戻り、ほかは保存した値のまま', () => {
      const raw = JSON.stringify({
        keys: { up: 'ArrowUp', down: '', left: 5, [a]: 'KeyQ' },
        pad: { [a]: 9, [b]: -1, [c]: 1.5, [lastButton]: '3' },
      });
      const r = parseBindings(raw, p);
      expect(r.keys['up']).toBe('ArrowUp');
      expect(r.keys['down']).toBe(p.defaultKeys['down']);
      expect(r.keys['left']).toBe(p.defaultKeys['left']);
      expect(r.keys[a]).toBe('KeyQ');
      expect(r.keys['right']).toBe(p.defaultKeys['right']);
      expect(r.pad[a]).toBe(9);
      expect(r.pad[b]).toBe(p.defaultPad[b]);
      expect(r.pad[c]).toBe(p.defaultPad[c]);
      expect(r.pad[lastButton]).toBe(p.defaultPad[lastButton]);
    });

    it('番号 0 は有効', () => {
      const r = parseBindings(JSON.stringify({ pad: { [a]: 0 } }), p);
      expect(r.pad[a]).toBe(0);
    });

    it('一部の操作がないときは、ない操作だけ初期値', () => {
      const r = parseBindings(JSON.stringify({ keys: { up: 'ArrowUp' }, pad: {} }), p);
      expect(r.keys).toEqual({ ...p.defaultKeys, up: 'ArrowUp' });
      expect(r.pad).toEqual(p.defaultPad);
    });

    it('知らない操作・ボタンは捨てる', () => {
      const r = parseBindings(JSON.stringify({ keys: { ...p.defaultKeys, Foo: 'KeyZ' }, pad: { ...p.defaultPad, Foo: 3 } }), p);
      expect(Object.keys(r.keys).sort()).toEqual([...actionsFor(p)].sort());
      expect(Object.keys(r.pad).sort()).toEqual([...p.buttons].sort());
    });
  });
}

describe('parseBindings: ゲームをまたいだ保存内容 (受け入れ条件 4)', () => {
  it('SF6 の保存内容を GG で読むと、LP など GG にない操作は捨てて、GG の操作は初期値', () => {
    const sf6 = defaultBindings(PROFILES.sf6);
    sf6.keys['LP'] = 'KeyQ';
    sf6.keys['up'] = 'ArrowUp';
    sf6.pad['LP'] = 9;
    const r = parseBindings(JSON.stringify(sf6), PROFILES.ggst);
    expect(r.keys['LP']).toBeUndefined();
    expect(r.keys['MP']).toBeUndefined();
    expect(r.pad['LP']).toBeUndefined();
    expect(r.keys['up']).toBe('ArrowUp');
    expect(r.keys['P']).toBe(PROFILES.ggst.defaultKeys['P']);
    expect(r.pad['P']).toBe(PROFILES.ggst.defaultPad['P']);
    expect(Object.keys(r.keys).sort()).toEqual([...actionsFor(PROFILES.ggst)].sort());
  });

  it('GG の保存内容を SF6 で読むと、GG のボタンは捨てて、SF6 のボタンは初期値', () => {
    const gg = defaultBindings(PROFILES.ggst);
    gg.keys['P'] = 'KeyQ';
    const r = parseBindings(JSON.stringify(gg), PROFILES.sf6);
    expect(r.keys['HS']).toBeUndefined();
    expect(r.keys['D']).toBeUndefined();
    expect(r.keys['LP']).toBe(PROFILES.sf6.defaultKeys['LP']);
  });
});
