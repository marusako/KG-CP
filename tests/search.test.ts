import { describe, expect, it } from 'vitest';
import { filterItems, normalizeQuery } from '../src/core/search';

describe('normalizeQuery (第6段階 受け入れ条件 5)', () => {
  it('全角の数字は半角になる', () => {
    expect(normalizeQuery('２３６')).toBe('236');
  });
  it('大文字は小文字になる', () => {
    expect(normalizeQuery('Spiral')).toBe('spiral');
  });
  it('全角の英字も半角の小文字になる', () => {
    expect(normalizeQuery('ＳＰＩＲＡＬ')).toBe('spiral');
  });
  it('前後の空白を取る', () => {
    expect(normalizeQuery('  236K \n')).toBe('236k');
  });
  it('空文字は空文字', () => {
    expect(normalizeQuery('')).toBe('');
  });
});

describe('filterItems (第6段階 受け入れ条件 5)', () => {
  const items = [
    { name: 'Spiral Arrow (236K)', notation: '236' },
    { name: 'Cannon Spike (623K)', notation: '623' },
    { name: 'Quick Spin Knuckle (214P)', notation: '214' },
    { name: 'Killer Bee Assault (214214P)', notation: '214214' },
  ];
  const texts = (i: (typeof items)[number]) => [i.name, i.notation];
  const names = (list: typeof items) => list.map((i) => i.name);

  it('空の検索は全部を、元の順で返す', () => {
    expect(filterItems(items, '', texts)).toEqual(items);
    expect(filterItems(items, '   ', texts)).toEqual(items);
  });

  it('名前の一部で絞れる (大文字小文字を区別しない)', () => {
    expect(names(filterItems(items, 'spiral', texts))).toEqual(['Spiral Arrow (236K)']);
    expect(names(filterItems(items, 'SPIRAL', texts))).toEqual(['Spiral Arrow (236K)']);
  });

  it('表記で絞れる。全角の数字も同じ', () => {
    expect(names(filterItems(items, '236', texts))).toEqual(['Spiral Arrow (236K)']);
    expect(names(filterItems(items, '２３６', texts))).toEqual(['Spiral Arrow (236K)']);
  });

  it('空白で区切った語は、すべてが当たるものだけ (AND)。「236 k」は Spiral Arrow (236K)', () => {
    expect(names(filterItems(items, '236 k', texts))).toEqual(['Spiral Arrow (236K)']);
    expect(names(filterItems(items, 'spiral 623', texts))).toEqual([]);
  });

  it('語ごとに、別の texts に当たってもよい', () => {
    expect(names(filterItems(items, 'knuckle 214', texts))).toEqual(['Quick Spin Knuckle (214P)']);
  });

  it('順番は元のまま', () => {
    expect(names(filterItems(items, '214', texts))).toEqual([
      'Quick Spin Knuckle (214P)',
      'Killer Bee Assault (214214P)',
    ]);
    expect(names(filterItems(items, 'k', texts))).toEqual(names(items.filter((i) => /k/i.test(i.name + i.notation))));
  });

  it('当たるものがなければ空の配列', () => {
    expect(filterItems(items, 'zzz', texts)).toEqual([]);
  });

  it('元の配列を書き換えない', () => {
    const copy = [...items];
    filterItems(items, '236', texts);
    expect(items).toEqual(copy);
  });
});
