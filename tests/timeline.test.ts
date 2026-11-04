import { describe, expect, it } from 'vitest';
import { KeyTimeline } from '../src/input/timeline';

const down = (code: string, time: number) => ({ code, down: true, time });
const up = (code: string, time: number) => ({ code, down: false, time });
const arr = (s: ReadonlySet<string>) => [...s].sort();

describe('KeyTimeline 割り振り (受け入れ条件 2)', () => {
  it('2 フレーム目の途中で押した down は 1 回目に入らず 2 回目に入る', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 25));
    expect(arr(t.sample(16.67))).toEqual([]);
    expect(arr(t.sample(33.33))).toEqual(['KeyA']);
  });

  it('1 フレーム目の途中で押した down は 1 回目から入る', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 10));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual(['KeyA']);
  });

  it('time == frameEnd のイベントは、そのフレームではなく次に入る', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 16.67));
    expect(arr(t.sample(16.67))).toEqual([]);
    expect(arr(t.sample(33.33))).toEqual(['KeyA']);
  });

  it('前の sample の frameEnd より前の時刻のイベントが後から届いたら、次の sample で取り出す', () => {
    const t = new KeyTimeline();
    expect(arr(t.sample(20))).toEqual([]);
    t.push(down('KeyA', 10));
    expect(arr(t.sample(40))).toEqual(['KeyA']);
  });
});

describe('KeyTimeline タップと押しっぱなし (受け入れ条件 3)', () => {
  it('フレーム内のタップはそのフレームに残り、次のフレームには残らない', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 5));
    t.push(up('KeyA', 10));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual([]);
  });

  it('押しっぱなしは次のフレームにも残り、離したフレームで消える（フレームの終わりの状態で決める）', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 5));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual(['KeyA']);
    t.push(up('KeyA', 40));
    expect(arr(t.sample(50))).toEqual([]);
    expect(arr(t.sample(66.67))).toEqual([]);
  });

  it('複数キーを同時に扱える', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 1));
    t.push(down('KeyB', 2));
    t.push(up('KeyB', 3));
    expect(arr(t.sample(16.67))).toEqual(['KeyA', 'KeyB']);
    expect(arr(t.sample(33.33))).toEqual(['KeyA']);
  });
});

describe('KeyTimeline 無視と clear (受け入れ条件 4)', () => {
  it('押下中の down (キーリピート) は何もしない: 離せば消える', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 1));
    t.push(down('KeyA', 5));
    t.push(up('KeyA', 10));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual([]);
  });

  it('キーリピートはタップとして数えない', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 1));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    t.push(up('KeyA', 20));
    t.push(down('KeyA', 22)); // これは新しい押下
    t.push(down('KeyA', 23)); // リピート
    expect(arr(t.sample(33.33))).toEqual(['KeyA']);
    expect(arr(t.sample(50))).toEqual(['KeyA']);
  });

  it('押していないキーの up は何もしない', () => {
    const t = new KeyTimeline();
    t.push(up('KeyA', 5));
    expect(arr(t.sample(16.67))).toEqual([]);
    expect(arr(t.sample(33.33))).toEqual([]);
  });

  it('押していないキーの up の後の down は普通に押下になる', () => {
    const t = new KeyTimeline();
    t.push(up('KeyA', 5));
    t.push(down('KeyA', 8));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual(['KeyA']);
  });

  it('clear で押下状態が消える', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 1));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    t.clear();
    expect(arr(t.sample(33.33))).toEqual([]);
  });

  it('clear で積んだイベントも消える', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 20));
    t.clear();
    expect(arr(t.sample(33.33))).toEqual([]);
    expect(arr(t.sample(50))).toEqual([]);
  });

  it('clear の後の up は「押していないキーの up」として何もしない', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 1));
    t.sample(16.67);
    t.clear();
    t.push(up('KeyA', 20));
    expect(arr(t.sample(33.33))).toEqual([]);
  });
});

describe('KeyTimeline 並び順 (受け入れ条件 5)', () => {
  it('push の順番が時刻とずれていても時刻順に反映する (down と up が逆順で届く)', () => {
    const t = new KeyTimeline();
    t.push(up('KeyA', 10));
    t.push(down('KeyA', 5));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual([]);
  });

  it('時刻順では up が先なら、押していない up は無視され、あとの down が残る', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 10));
    t.push(up('KeyA', 5));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual(['KeyA']);
  });

  it('time が同じイベントは積んだ順に反映する (down → up)', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 5));
    t.push(up('KeyA', 5));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual([]);
  });

  it('time が同じイベントは積んだ順に反映する (up → down)', () => {
    const t = new KeyTimeline();
    t.push(up('KeyA', 5));
    t.push(down('KeyA', 5));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual(['KeyA']);
  });

  it('フレームをまたぐ順序ずれも、フレームごとに時刻どおり割り振る', () => {
    const t = new KeyTimeline();
    t.push(down('KeyB', 25));
    t.push(down('KeyA', 5));
    expect(arr(t.sample(16.67))).toEqual(['KeyA']);
    expect(arr(t.sample(33.33))).toEqual(['KeyA', 'KeyB']);
  });
});

describe('KeyTimeline.sampleDetailed (受け入れ条件 9)', () => {
  it('押されていない状態からの down は fresh に入る', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 5));
    const r = t.sampleDetailed(16.67);
    expect(arr(r.pressed)).toEqual(['KeyA']);
    expect(arr(r.fresh)).toEqual(['KeyA']);
  });

  it('キーリピートの down（すでに押している状態での down）は fresh に入らない', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 5));
    t.sampleDetailed(16.67);
    t.push(down('KeyA', 20));
    const r = t.sampleDetailed(33.33);
    expect(arr(r.pressed)).toEqual(['KeyA']);
    expect(arr(r.fresh)).toEqual([]);
  });

  it('押しっぱなしの次のフレームは fresh が空', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 5));
    t.sampleDetailed(16.67);
    const r = t.sampleDetailed(33.33);
    expect(arr(r.pressed)).toEqual(['KeyA']);
    expect(arr(r.fresh)).toEqual([]);
  });

  it('フレーム内タップ（down → up）は fresh に入る', () => {
    const t = new KeyTimeline();
    t.push(down('KeyA', 3));
    t.push(up('KeyA', 8));
    const r = t.sampleDetailed(16.67);
    expect(arr(r.fresh)).toEqual(['KeyA']);
  });

  it('pressed は sample と同じ結果になる', () => {
    const events = [down('KeyA', 5), down('KeyB', 25), up('KeyA', 30), down('KeyA', 40), down('KeyA', 45), up('KeyB', 50)];
    const a = new KeyTimeline();
    const b = new KeyTimeline();
    for (const e of events) {
      a.push(e);
      b.push(e);
    }
    for (const end of [16.67, 33.33, 50, 66.67]) {
      expect(arr(b.sampleDetailed(end).pressed)).toEqual(arr(a.sample(end)));
    }
  });
});
