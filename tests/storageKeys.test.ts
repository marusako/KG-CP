import { describe, expect, it } from 'vitest';
import { bindingsKeys, readFirst, recipesKeys } from '../src/core/storageKeys';

describe('bindingsKeys（キーの割り当ての保存場所）', () => {
  it('スト6 は新しいキーに保存し、なければ前の版のキーも読む', () => {
    expect(bindingsKeys('sf6')).toEqual({ save: 'kg-cp:bindings:sf6', read: ['kg-cp:bindings:sf6', 'kg-cp:bindings'] });
  });
  it('GG は自分のキーだけを読む（スト6 の前の版のデータを読まない）', () => {
    expect(bindingsKeys('ggst')).toEqual({ save: 'kg-cp:bindings:ggst', read: ['kg-cp:bindings:ggst'] });
  });
});

describe('recipesKeys（読み込んだレシピの保存場所）', () => {
  it('スト6 は新しいキーに保存し、なければ前の版のキーも読む', () => {
    expect(recipesKeys('sf6')).toEqual({ save: 'kgcp.comboRecipes.sf6', read: ['kgcp.comboRecipes.sf6', 'kgcp.comboRecipes'] });
  });
  it('GG は自分のキーだけを読む', () => {
    expect(recipesKeys('ggst')).toEqual({ save: 'kgcp.comboRecipes.ggst', read: ['kgcp.comboRecipes.ggst'] });
  });
  it('保存する場所は、前の版のキーと重ならない（前の版のデータを上書きしない）', () => {
    for (const id of ['sf6', 'ggst'] as const) {
      expect(recipesKeys(id).save).not.toBe('kgcp.comboRecipes');
      expect(bindingsKeys(id).save).not.toBe('kg-cp:bindings');
    }
  });
});

describe('recipesKeys（キャラごとの保存場所。第6段階 受け入れ条件 7）', () => {
  it('キャラがあるときは、そのキャラのキーだけに保存し、読む', () => {
    expect(recipesKeys('sf6', 'cammy')).toEqual({
      save: 'kgcp.comboRecipes.sf6.cammy',
      read: ['kgcp.comboRecipes.sf6.cammy'],
    });
    expect(recipesKeys('ggst', 'bridget')).toEqual({
      save: 'kgcp.comboRecipes.ggst.bridget',
      read: ['kgcp.comboRecipes.ggst.bridget'],
    });
  });
  it('キャラなしは、いまと同じ', () => {
    expect(recipesKeys('sf6', undefined)).toEqual(recipesKeys('sf6'));
    expect(recipesKeys('sf6')).toEqual({ save: 'kgcp.comboRecipes.sf6', read: ['kgcp.comboRecipes.sf6', 'kgcp.comboRecipes'] });
  });
  it('キャラありのとき、前の版やキャラなしのデータは読まない', () => {
    const get = (key: string) => ({ 'kgcp.comboRecipes.sf6': 'a', 'kgcp.comboRecipes': 'b' } as Record<string, string>)[key] ?? null;
    expect(readFirst(get, recipesKeys('sf6', 'cammy').read)).toBeNull();
  });
});

describe('readFirst', () => {
  const store = (data: Record<string, string>) => (key: string) => data[key] ?? null;

  it('並びの順に見て、最初に見つかったものを返す', () => {
    const get = store({ 'kg-cp:bindings:sf6': 'new', 'kg-cp:bindings': 'old' });
    expect(readFirst(get, bindingsKeys('sf6').read)).toBe('new');
  });
  it('新しいキーがなければ、前の版のキーを読む', () => {
    const get = store({ 'kg-cp:bindings': 'old' });
    expect(readFirst(get, bindingsKeys('sf6').read)).toBe('old');
  });
  it('GG は前の版のスト6 のデータがあっても読まない', () => {
    const get = store({ 'kg-cp:bindings': 'old', 'kgcp.comboRecipes': 'old-recipes' });
    expect(readFirst(get, bindingsKeys('ggst').read)).toBeNull();
    expect(readFirst(get, recipesKeys('ggst').read)).toBeNull();
  });
  it('空の文字列も「保存されている」として返す', () => {
    const get = store({ 'kgcp.comboRecipes.sf6': '', 'kgcp.comboRecipes': 'old' });
    expect(readFirst(get, recipesKeys('sf6').read)).toBe('');
  });
  it('どこにもなければ null', () => {
    expect(readFirst(store({}), recipesKeys('sf6').read)).toBeNull();
  });
});
