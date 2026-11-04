import { describe, expect, it } from 'vitest';
import { DEFAULT_COMMANDS } from '../src/core/commands';

describe('DEFAULT_COMMANDS', () => {
  it('プランに挙がったコマンド id を含む', () => {
    const ids = DEFAULT_COMMANDS.map((c) => c.id);
    for (const id of ['236P', '214P', '623P', '41236P', '63214P', '[4]6P', '[2]8K', '360P']) {
      expect(ids).toContain(id);
    }
  });

  it('360P は rotation、他の挙がったコマンドは motion', () => {
    const byId = new Map(DEFAULT_COMMANDS.map((c) => [c.id, c]));
    expect(byId.get('360P')?.kind).toBe('rotation');
    expect(byId.get('236P')?.kind).toBe('motion');
  });
});
