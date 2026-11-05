import { describe, expect, it } from 'vitest';

describe('describeHit（成功した手の下に出す文）', () => {
  const load = async () => (await import('../src/ui/comboPanel')).describeHit;

  it('最初の手（offset が null）は OK', async () => {
    const describeHit = await load();
    expect(describeHit(null, null)).toBe('OK');
  });

  it('窓の中で押したときは +{offset}F', async () => {
    const describeHit = await load();
    expect(describeHit(10, { min: 10, max: 14 })).toBe('+10F');
    expect(describeHit(14, { min: 10, max: 14 })).toBe('+14F');
    expect(describeHit(0, { min: 0, max: 10 })).toBe('+0F');
  });

  it('先行入力で成功したときは、何 F 早かったかも出す', async () => {
    const describeHit = await load();
    expect(describeHit(8, { min: 10, max: 14 })).toBe('+8F（先行 2F）');
  });

  it('offset がマイナスのときは「+-」にならず、符号つきで出す', async () => {
    const describeHit = await load();
    expect(describeHit(-1, { min: 0, max: 10 })).toBe('-1F（先行 1F）');
    expect(describeHit(-3, { min: 0, max: 8 })).toBe('-3F（先行 3F）');
  });
});
