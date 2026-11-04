import { describe, expect, it } from 'vitest';
import { assignKey, assignPad } from '../src/input/bindings';

// Action の具体的な定義に依存しないよう、関数の引数の型から取り出す
type Keys = Parameters<typeof assignKey>[0];
type Action = Parameters<typeof assignKey>[1];
type Pad = Parameters<typeof assignPad>[0];
type PadButton = Parameters<typeof assignPad>[1];

const LP = 'LP' as unknown as Action;
const MP = 'MP' as unknown as Action;
const HP = 'HP' as unknown as Action;

function makeKeys(): Keys {
  return { LP: 'KeyU', MP: 'KeyI', HP: 'KeyO' } as unknown as Keys;
}

function read(obj: unknown, name: string): unknown {
  return (obj as Record<string, unknown>)[name];
}

describe('assignKey (受け入れ条件 10)', () => {
  it('他の操作が使っていないキーなら、その操作だけが変わり swappedWith は null', () => {
    const r = assignKey(makeKeys(), LP, 'KeyP');
    expect(read(r.keys, 'LP')).toBe('KeyP');
    expect(read(r.keys, 'MP')).toBe('KeyI');
    expect(read(r.keys, 'HP')).toBe('KeyO');
    expect(r.swappedWith).toBeNull();
  });

  it('別の操作が使っているキーを割り当てると、その操作に元のキーを渡して入れ替える', () => {
    const r = assignKey(makeKeys(), LP, 'KeyI');
    expect(read(r.keys, 'LP')).toBe('KeyI');
    expect(read(r.keys, 'MP')).toBe('KeyU');
    expect(read(r.keys, 'HP')).toBe('KeyO');
    expect(r.swappedWith).toBe('MP');
  });

  it('入れ替え後も、同じキーを複数の操作が持たない', () => {
    const r = assignKey(makeKeys(), HP, 'KeyU');
    const values = Object.values(r.keys as Record<string, string>);
    expect(new Set(values).size).toBe(values.length);
  });

  it('同じ操作に同じキーを割り当て直しても何も変わらず、swappedWith は null', () => {
    const r = assignKey(makeKeys(), MP, 'KeyI');
    expect(r.keys).toEqual(makeKeys());
    expect(r.swappedWith).toBeNull();
  });

  it('引数の keys を書き換えない (通常の割り当て・入れ替えの両方)', () => {
    const keys = makeKeys();
    assignKey(keys, LP, 'KeyP');
    assignKey(keys, LP, 'KeyI');
    expect(keys).toEqual(makeKeys());
  });

  it('新しいオブジェクトを返す', () => {
    const keys = makeKeys();
    const r = assignKey(keys, LP, 'KeyU');
    expect(r.keys).not.toBe(keys);
  });
});

describe('assignPad (受け入れ条件 10)', () => {
  const B0 = 'LP' as unknown as PadButton;
  const B1 = 'MP' as unknown as PadButton;

  function makePad(): Pad {
    return { LP: 0, MP: 1, HP: 5 } as unknown as Pad;
  }

  it('他のボタンが使っていない番号なら、そのボタンだけが変わり swappedWith は null', () => {
    const r = assignPad(makePad(), B0, 9);
    expect(read(r.pad, 'LP')).toBe(9);
    expect(read(r.pad, 'MP')).toBe(1);
    expect(read(r.pad, 'HP')).toBe(5);
    expect(r.swappedWith).toBeNull();
  });

  it('別のボタンが使っている番号を割り当てると、そのボタンに元の番号を渡して入れ替える', () => {
    const r = assignPad(makePad(), B0, 1);
    expect(read(r.pad, 'LP')).toBe(1);
    expect(read(r.pad, 'MP')).toBe(0);
    expect(read(r.pad, 'HP')).toBe(5);
    expect(r.swappedWith).toBe('MP');
  });

  it('同じボタンに同じ番号を割り当て直しても何も変わらず、swappedWith は null', () => {
    const r = assignPad(makePad(), B1, 1);
    expect(r.pad).toEqual(makePad());
    expect(r.swappedWith).toBeNull();
  });

  it('番号 0 も正しく扱う (0 を使っているボタンと入れ替わる)', () => {
    const r = assignPad(makePad(), B1, 0);
    expect(read(r.pad, 'MP')).toBe(0);
    expect(read(r.pad, 'LP')).toBe(1);
    expect(r.swappedWith).toBe('LP');
  });

  it('引数の pad を書き換えない', () => {
    const pad = makePad();
    assignPad(pad, B0, 9);
    assignPad(pad, B0, 1);
    expect(pad).toEqual(makePad());
  });
});
