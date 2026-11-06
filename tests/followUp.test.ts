// 第17段階 受け入れ条件 1〜6・8（派生技）: データの形と、本物の stepFighter・stepDummy での動き、コンボトライアルの派生の手。
// 条件 7（表記）は tests/notation.test.ts、文は tests/i18n.test.ts。
// フレームは、1 手目（親の技）のボタンを押したフレームを 0 とする（inputBuffer = 4）。
// 'frames' の受付は、親の技を出したフレームを 1 として [from, to] フレーム目なので、frame n は n + 1 フレーム目。
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/core/characters';
import { parseRecipe } from '../src/core/combo';
import type { ComboRecipe } from '../src/core/combo';
import { initialSimTrial, resolveRecipe, stepSimTrial } from '../src/core/comboSim';
import type { SimFrame, SimTrialEvent } from '../src/core/comboSim';
import { INITIAL_DUMMY, stepDummy } from '../src/core/dummy';
import type { DummyState } from '../src/core/dummy';
import { INITIAL_FIGHTER, stepFighter } from '../src/core/fighter';
import { judgeFollowUp } from '../src/core/followUp';
import type { FighterState } from '../src/core/fighter';
import { contactReaction, fighterDataFor } from '../src/core/frameData';
import type { DummyMode, MoveFrames } from '../src/core/frameData';
import type { NotationRules } from '../src/core/notation';
import { PROFILES } from '../src/core/profiles';
import type { FrameInput } from '../src/core/types';

const who = {
  cammy: { c: { data: fighterDataFor('cammy')!, character: CHARACTERS.find((c) => c.id === 'cammy')! }, rules: PROFILES.sf6 },
  bridget: { c: { data: fighterDataFor('bridget')!, character: CHARACTERS.find((c) => c.id === 'bridget')! }, rules: PROFILES.ggst },
};
type Who = keyof typeof who;

const N: FrameInput = { dir: 5, buttons: [] };
const b = (dir: FrameInput['dir'], ...buttons: string[]): FrameInput => ({ dir, buttons });
type Entries = [number, FrameInput][];
const c236 = (f: number, btn: string): Entries => [[f - 2, b(2)], [f - 1, b(3)], [f, b(6, btn)]];
const INPUT_BUFFER = 4;
const ORIGIN = 20; // 1 手目の前の free の長さ。frame n の入力は inputs[ORIGIN + n]

const moveOf = (name: Who, input: string): MoveFrames => {
  const m = who[name].c.data.moves.find((x) => x.input === input);
  if (!m) throw new Error(`${name} に ${input} がありません`);
  return m;
};
const followOf = (name: Who, parent: string, input: string) => {
  const f = moveOf(name, parent).followUps?.find((x) => x.input === input);
  if (!f) throw new Error(`${name} ${parent} に派生 ${input} がありません`);
  return f;
};

// ---------------------------------------------------------------- 受け入れ条件 1: データ

describe('派生のデータ (第17段階 受け入れ条件 1)', () => {
  const kd = (n: number) => ({ knockdown: n });
  // 第17段階: フーリガン（236LP・236MP・236HP）も必殺技なので、5LP・2LP・5HP・5LK・2MP・2MK と 5HP>HK のキャンセル先に入る
  const CAMMY_SPECIAL = ['236LK', '236MK', '236HK', '623LK', '623MK', '623HK', '214LP', '214MP', '214HP', '236LP', '236MP', '236HP'];
  const CAMMY_SA = ['236236K', '214214P', '236236P'];

  it('ブリジット 236K の派生は 2 つ（P・K）。受付は 10〜34 フレーム目（推測）、move.input は 236K~P・236K~K', () => {
    const fu = moveOf('bridget', '236K').followUps ?? [];
    expect(fu.map((f) => f.input).sort()).toEqual(['K', 'P']);
    for (const f of fu) {
      expect(f.window).toEqual({ kind: 'frames', from: 10, to: 34 });
      expect(f.move.input).toBe(`236K~${f.input}`);
    }
  });

  it('236K~P: 発生前 6・持続 7・硬直 19、ヒットなし、ガード -6、ヒットストップ 13', () => {
    const m = followOf('bridget', '236K', 'P').move;
    expect([m.startup, m.active, m.recovery, m.onHit, m.onBlock, m.hitstop]).toEqual([6, 7, 19, undefined, -6, 13]);
    expect(m.throw).toBeUndefined();
    expect(m.noHitbox).toBeUndefined();
  });

  it('236K~K: 発生前 2・持続 20・硬直 24、ヒットなし、ガード -33、ヒットストップ 13', () => {
    const m = followOf('bridget', '236K', 'K').move;
    expect([m.startup, m.active, m.recovery, m.onHit, m.onBlock, m.hitstop]).toEqual([2, 20, 24, undefined, -33, 13]);
  });

  it('キャミィ 5HP の派生は HK だけ。受付は contact 19、move.input は 5HP>HK。cancels は今のまま（必殺技・SA）', () => {
    const p = moveOf('cammy', '5HP');
    expect(p.followUps?.map((f) => f.input)).toEqual(['HK']);
    expect(p.followUps![0]!.window).toEqual({ kind: 'contact', frames: 19 });
    expect(p.followUps![0]!.move.input).toBe('5HP>HK');
    expect([...(p.cancels ?? [])].sort()).toEqual([...CAMMY_SPECIAL, ...CAMMY_SA].sort());
  });

  it('5HP>HK: 発生前 12・持続 19・硬直 29、ヒット KD 26、ガード -12、ヒットストップ 11、キャンセル先は必殺技と SA', () => {
    const m = followOf('cammy', '5HP', 'HK').move;
    expect([m.startup, m.active, m.recovery, m.onHit, m.onBlock, m.hitstop]).toEqual([12, 19, 29, kd(26), -12, 11]);
    for (const c of [...CAMMY_SPECIAL, ...CAMMY_SA]) expect(m.cancels ?? [], c).toContain(c);
  });

  for (const btn of ['LP', 'MP', 'HP']) {
    const parent = `236${btn}`;

    describe(`${parent}（フーリガン。派生なしならレイザーエッジスライサー）`, () => {
      it('親そのものが、発生前 49・持続 9・硬直 13、ヒット KD 48、ガード +2、ヒットストップ 13、キャンセル先 236236P', () => {
        const m = moveOf('cammy', parent);
        expect([m.startup, m.active, m.recovery, m.onHit, m.onBlock, m.hitstop]).toEqual([49, 9, 13, kd(48), 2, 13]);
        expect(m.cancels).toEqual(['236236P']);
      });

      it('派生は K・2K・LPLK・P の 4 つ。どれも受付は 20〜40 フレーム目、move.input は 親>派生', () => {
        const fu = moveOf('cammy', parent).followUps ?? [];
        expect(fu.map((f) => f.input).sort()).toEqual(['2K', 'K', 'LPLK', 'P']);
        for (const f of fu) {
          expect(f.window, f.input).toEqual({ kind: 'frames', from: 20, to: 40 });
          expect(f.move.input, f.input).toBe(`${parent}>${f.input}`);
        }
      });

      it('K（キャノンストライク）: 発生前 12・持続 10（推測）・硬直 12、ヒットストップ 13、反応のデータなし', () => {
        const m = followOf('cammy', parent, 'K').move;
        expect([m.startup, m.active, m.recovery, m.hitstop, m.onHit, m.onBlock]).toEqual([12, 10, 12, 13, undefined, undefined]);
      });

      it('2K（リバースエッジ）: 発生前 17・持続 4・硬直 13、ヒットストップ 13、反応のデータなし', () => {
        const m = followOf('cammy', parent, '2K').move;
        expect([m.startup, m.active, m.recovery, m.hitstop, m.onHit, m.onBlock]).toEqual([17, 4, 13, 13, undefined, undefined]);
      });

      it('LPLK（ファタルレッグツイスター）: 投げ。発生前 9・持続 3・硬直 30、ヒット KD 18、ヒットストップなし', () => {
        const m = followOf('cammy', parent, 'LPLK').move;
        expect([m.startup, m.active, m.recovery, m.onHit, m.hitstop]).toEqual([9, 3, 30, kd(18), undefined]);
        expect(m.throw).toBe(true);
        expect(m.noHitbox).toBeUndefined();
      });

      it('P（サイレントステップ）: 攻撃なし。発生前 1・持続 1（推測）・硬直 14、反応のデータなし', () => {
        const m = followOf('cammy', parent, 'P').move;
        expect([m.startup, m.active, m.recovery, m.onHit, m.onBlock]).toEqual([1, 1, 14, undefined, undefined]);
        expect(m.noHitbox).toBe(true);
        expect(m.throw).toBeUndefined();
      });
    });
  }

  it('派生を持たない技（5LP・2MK・236K~P の中など）に followUps はない', () => {
    expect(moveOf('cammy', '5LP').followUps).toBeUndefined();
    expect(moveOf('bridget', '5P').followUps).toBeUndefined();
  });
});

describe('throw・noHitbox の反応（contactReaction・stepDummy）', () => {
  const throwMove = (): MoveFrames => followOf('cammy', '236LP', 'LPLK').move;

  it('contactReaction: 投げは、ガード（block）でもヒットの反応（ダウン。51 = 18 + 3 + 30、有利 18）', () => {
    for (const mode of ['hit', 'block'] as DummyMode[]) {
      expect(contactReaction(throwMove(), mode), mode).toEqual({ kind: 'down', frames: 51, advantage: 18 });
    }
  });

  it('contactReaction: throw でない同じ数字の技は、ガードでは反応なし（throw の印の効果）', () => {
    const { throw: _t, ...plain } = throwMove();
    expect(contactReaction(plain, 'block')).toBeNull();
    expect(contactReaction(plain, 'hit')?.kind).toBe('down');
  });

  it('stepDummy: noHitbox の技は、反応のデータがあっても持続の 1 フレーム目に当たらない', () => {
    const move: MoveFrames = { input: 'x', startup: 3, active: 3, recovery: 5, onHit: 2, onBlock: -2, hitstop: 9, noHitbox: true };
    const fighter: FighterState = { phase: 'active', frame: 0, move, buffered: null };
    for (const mode of ['hit', 'block'] as DummyMode[]) {
      const r = stepDummy(INITIAL_DUMMY, fighter, mode);
      expect(r.contact, mode).toBeNull();
      expect(r.dummy.phase, mode).toBe('free');
      expect(r.fighter.contact, mode).toBeUndefined();
    }
    // 対照: noHitbox がなければ当たる
    const { noHitbox: _n, ...normal } = move;
    expect(stepDummy(INITIAL_DUMMY, { ...fighter, move: normal }, 'hit').contact).not.toBeNull();
  });
});

// ---------------------------------------------------------------- キャラの動き

interface Frame {
  fighter: FighterState;
  dummy: DummyState;
  contactKind: string | null;
  contact: ReturnType<typeof stepDummy>['contact'];
}

function play(entries: Entries, length: number, mode: DummyMode, name: Who, startDummy: DummyState = INITIAL_DUMMY) {
  const { c, rules } = who[name];
  const inputs: FrameInput[] = Array.from({ length: ORIGIN + length }, () => N);
  for (const [f, input] of entries) inputs[ORIGIN + f] = input;
  let fighter: FighterState = INITIAL_FIGHTER;
  let dummy: DummyState = startDummy;
  const history: FrameInput[] = [];
  const out: Frame[] = [];
  for (const input of inputs) {
    history.push(input);
    const stepped = stepFighter(fighter, history, c, rules, rules.inputBuffer);
    const r = stepDummy(dummy, stepped, mode);
    out.push({ fighter: r.fighter, dummy: r.dummy, contact: r.contact, contactKind: r.contact?.kind ?? null });
    fighter = r.fighter;
    dummy = r.dummy;
  }
  return {
    at: (n: number): Frame => out[ORIGIN + n]!,
    frames: () => out.slice(ORIGIN),
    contactFrames: () => out.slice(ORIGIN).flatMap((f, n) => (f.contact ? [n] : [])),
    /** 派生が出たフレーム */
    followUpFrames: () => out.slice(ORIGIN).flatMap((f, n) => (f.fighter.followUp === true ? [n] : [])),
    moveInputs: () => out.slice(ORIGIN).map((f) => f.fighter.move?.input ?? null),
  };
}

describe('ブリジット 236K~P (第17段階 受け入れ条件 2)', () => {
  const P = b(5, 'P');
  // 236K 自身も 9 で相手に当たってヒットストップで止まるので、受付だけを確かめるときは、相手がダウン中（当たらない）にする
  const DOWN: DummyState = { phase: 'down', remaining: 500 };
  const run = (n: number, mode: DummyMode = 'hit', dummy: DummyState = DOWN) =>
    play([...c236(0, 'K'), [n, P]], 80, mode, 'bridget', dummy);

  it('下準備: 236K（発生前 9）は 0 から出て、9 で持続に入る', () => {
    const r = play(c236(0, 'K'), 40, 'hit', 'bridget');
    expect(r.at(0).fighter.move?.input).toBe('236K');
    expect([r.at(8).fighter.phase, r.at(9).fighter.phase]).toEqual(['startup', 'active']);
  });

  it('8（9 フレーム目、受付の前）の P は派生にならない（236K~P は一度も出ない）', () => {
    const r = run(8);
    expect(r.followUpFrames()).toEqual([]);
    expect(r.moveInputs().includes('236K~P')).toBe(false);
  });

  it('9〜33（10〜34 フレーム目）のどこで P を押しても、そのフレームから 236K~P（startup の 0 フレーム目、followUp: true、canceled なし）', () => {
    for (const n of [9, 10, 20, 32, 33]) {
      const f = run(n).at(n).fighter;
      expect([f.move?.input, f.phase, f.frame, f.followUp, f.canceled], `n=${n}`).toEqual(['236K~P', 'startup', 0, true, undefined]);
      expect(f.contact, `n=${n}`).toBeUndefined();
    }
  });

  it('派生は押したフレームから 6 フレーム先で持続に入る（発生前 6）', () => {
    const r = run(15);
    expect([r.at(20).fighter.phase, r.at(21).fighter.phase, r.at(21).fighter.move?.input]).toEqual(['startup', 'active', '236K~P']);
  });

  it('34 以降（35 フレーム目以降）の P は派生にならない', () => {
    for (const n of [34, 35, 40]) {
      const r = run(n);
      expect(r.followUpFrames(), `n=${n}`).toEqual([]);
      expect(r.moveInputs().includes('236K~P'), `n=${n}`).toBe(false);
    }
  });

  it('ガードの相手に 236K~P が当たると blockstun（有利 -6）。受付の最初（9）に押すと、236K が持続に入る前に切り替わる', () => {
    const blocked = run(9, 'block', INITIAL_DUMMY);
    // 236K~P は 9 から出て、15 で持続に入る
    expect(blocked.at(15).fighter.move?.input).toBe('236K~P');
    expect(blocked.at(15).contact).toMatchObject({ kind: 'block', advantage: -6 });
    expect(blocked.at(15).dummy.phase).toBe('blockstun');
    expect(blocked.at(15).dummy.remaining).toBe(20); // -6 + 7 + 19
    expect(blocked.contactFrames()).toEqual([15]);
  });

  it('K を押すと 236K~K（発生前 2）になる', () => {
    const r = play([...c236(0, 'K'), [15, b(5, 'K')]], 60, 'hit', 'bridget', DOWN);
    const f = r.at(15).fighter;
    expect([f.move?.input, f.phase, f.frame, f.followUp]).toEqual(['236K~K', 'startup', 0, true]);
    expect(r.at(17).fighter.phase).toBe('active');
  });

  it('派生のボタンを押していなければ、236K はそのまま進む（followUp なし）', () => {
    const r = play(c236(0, 'K'), 60, 'hit', 'bridget');
    expect(r.followUpFrames()).toEqual([]);
    expect(r.at(9).contact).not.toBeNull();
  });
});

describe('ブリジット 236K~P: 236K が当たってヒットストップで止まる場合（受付は止まっていたフレームを数えない）', () => {
  const P = b(5, 'P');
  const run = (n: number) => play([...c236(0, 'K'), [n, P]], 90, 'hit', 'bridget');

  it('下準備: 236K は 9 で当たり、10〜22 が止まる（hitstop 13）。23 から動く', () => {
    const r = play(c236(0, 'K'), 60, 'hit', 'bridget');
    expect(r.contactFrames()).toEqual([9]);
    for (let n = 10; n <= 22; n++) expect(r.at(n).fighter.frozen, `n=${n}`).toBe(true);
    expect(r.at(23).fighter.frozen).toBeUndefined();
  });

  it('止まっている間（10・15・22）に P を入れると予約され、止まり終わった 23 から 236K~P（followUp: true、canceled なし）', () => {
    for (const n of [10, 15, 22]) {
      const r = run(n);
      for (let k = 10; k <= 22; k++) expect(r.at(k).fighter.move?.input, `n=${n} k=${k}`).toBe('236K');
      const f = r.at(23).fighter;
      expect([f.move?.input, f.phase, f.frame, f.followUp, f.canceled], `n=${n}`).toEqual(['236K~P', 'startup', 0, true, undefined]);
    }
  });

  it('止まっていたフレームを数えないので、親の番号 33 にあたる 46 まで受け付け、47（番号 34）は出ない', () => {
    const f46 = run(46).at(46).fighter;
    expect([f46.move?.input, f46.phase, f46.frame, f46.followUp]).toEqual(['236K~P', 'startup', 0, true]);
    const r47 = run(47);
    expect(r47.followUpFrames()).toEqual([]);
    expect(r47.moveInputs().includes('236K~P')).toBe(false);
  });

  it('止まっていたフレームを数えるなら受付が 10〜22 分だけ早く切れるが、そうではない（33 + 13 = 46 の P が出る）', () => {
    // 数えると番号 = n なので 34 以降は出ないはず。数えないので 35 でも出る
    expect(run(35).at(35).fighter.move?.input).toBe('236K~P');
  });
});

describe('キャミィ 5HP > HK (第17段階 受け入れ条件 3)', () => {
  const HP = b(5, 'HP');
  const run = (n: number | null, mode: DummyMode = 'hit', dummy: DummyState = INITIAL_DUMMY) =>
    play([[0, HP], ...(n === null ? [] : ([[n, b(5, 'HK')]] as Entries))], 80, mode, 'cammy', dummy);

  it('下準備: 5HP は 7 で当たり、8〜20 が止まる', () => {
    const r = run(null);
    expect(r.contactFrames()).toEqual([7]);
    for (let n = 8; n <= 20; n++) expect(r.at(n).fighter.frozen, `n=${n}`).toBe(true);
    expect(r.at(21).fighter.frozen).toBeUndefined();
  });

  it('ヒットストップ中（10・8・20）に HK → 止まり終わった 21 から 5HP>HK（startup の 0 フレーム目、followUp: true、canceled なし）', () => {
    for (const n of [8, 10, 20]) {
      const r = run(n);
      for (let k = 8; k <= 20; k++) expect(r.at(k).fighter.move?.input, `n=${n} k=${k}`).toBe('5HP');
      const f = r.at(21).fighter;
      expect([f.move?.input, f.phase, f.frame, f.followUp, f.canceled], `n=${n}`).toEqual(['5HP>HK', 'startup', 0, true, undefined]);
      expect(f.contact, `n=${n}`).toBeUndefined();
    }
  });

  it('派生は 21 から発生前 12 で、33 で当たる（KD 26、combo: true）', () => {
    const r = run(10);
    expect(r.at(32).fighter.phase).toBe('startup');
    expect(r.at(33).fighter.phase).toBe('active');
    expect(r.contactFrames()).toEqual([7, 33]);
    expect(r.at(33).contact).toMatchObject({ kind: 'hit', knockdown: true, combo: true, advantage: 26 });
  });

  it('当たったフレームを 1 として 19 フレーム目（25）まで受け付ける: 25 で HK → 25 から 5HP>HK', () => {
    const r = run(25);
    const f = r.at(25).fighter;
    expect([f.move?.input, f.phase, f.frame, f.followUp]).toEqual(['5HP>HK', 'startup', 0, true]);
    expect(r.at(24).fighter.move?.input).toBe('5HP');
  });

  it('当たったフレームちょうど（7）の HK も受け付ける: 止まり終わった 21 から 5HP>HK（followUp: true、canceled なし）', () => {
    const r = run(7);
    expect(r.contactFrames()[0]).toBe(7);
    for (let k = 8; k <= 20; k++) expect(r.at(k).fighter.move?.input, `k=${k}`).toBe('5HP');
    const f = r.at(21).fighter;
    expect([f.move?.input, f.phase, f.frame, f.followUp, f.canceled]).toEqual(['5HP>HK', 'startup', 0, true, undefined]);
  });

  it('当たる前（6）の HK は、5HP>HK にならない（先行入力などで、派生は出ない）', () => {
    const r = run(6);
    expect(r.followUpFrames()).toEqual([]);
    expect(r.moveInputs().includes('5HP>HK')).toBe(false);
  });

  it('26 の HK は派生にならない（5HP の硬直のまま）', () => {
    const r = run(26);
    expect(r.followUpFrames()).toEqual([]);
    for (let n = 22; n <= 29; n++) expect(r.at(n).fighter.move?.input, `n=${n}`).toBe('5HP');
    expect(r.moveInputs().includes('5HP>HK')).toBe(false);
  });

  it('空振り（相手がダウン中で当たらない）では、HK を押しても派生にならない', () => {
    const down: DummyState = { phase: 'down', remaining: 200 };
    for (const n of [10, 21, 25]) {
      const r = run(n, 'hit', down);
      expect(r.contactFrames(), `n=${n}`).toEqual([]);
      expect(r.followUpFrames(), `n=${n}`).toEqual([]);
      expect(r.moveInputs().includes('5HP>HK'), `n=${n}`).toBe(false);
    }
  });

  it('ガードされても当たったことになるので、受付の中の HK で派生が出る（contact の受付は当たり方によらない）', () => {
    const r = run(10, 'block');
    expect(r.contactFrames()).toEqual([7, 33]);
    expect(r.at(21).fighter.move?.input).toBe('5HP>HK');
  });
});

describe('キャミィ フーリガン (第17段階 受け入れ条件 4)', () => {
  const LP236 = (extra: Entries = [], length = 100, mode: DummyMode = 'hit', dummy?: DummyState) =>
    play([...c236(0, 'LP'), ...extra], length, mode, 'cammy', dummy);

  it('何も入れない: 236LP がそのまま進み、50 フレーム目（49）で 1 回だけ当たる（KD 48）', () => {
    const r = LP236();
    expect(r.at(0).fighter.move?.input).toBe('236LP');
    expect(r.followUpFrames()).toEqual([]);
    expect(r.contactFrames()).toEqual([49]);
    expect([r.at(48).fighter.phase, r.at(49).fighter.phase, r.at(49).fighter.move?.input]).toEqual(['startup', 'active', '236LP']);
    expect(r.at(49).contact).toMatchObject({ kind: 'hit', knockdown: true, advantage: 48 });
    for (let n = 0; n <= 48; n++) expect(r.at(n).fighter.move?.input, `n=${n}`).toBe('236LP');
  });

  it('18（20 フレーム目の前）の K は派生にならない', () => {
    const r = LP236([[18, b(5, 'LK')]]);
    expect(r.followUpFrames()).toEqual([]);
    expect(r.moveInputs().includes('236LP>K')).toBe(false);
  });

  it('18 の 2K も派生にならない（受付の前）', () => {
    const r = LP236([[18, b(2, 'LK')]]);
    expect(r.followUpFrames()).toEqual([]);
  });

  it('19〜39（20〜40 フレーム目）の K は、そのフレームから 236LP>K（startup の 0 フレーム目、followUp: true、canceled なし）', () => {
    for (const n of [19, 25, 39]) {
      const f = LP236([[n, b(5, 'LK')]]).at(n).fighter;
      expect([f.move?.input, f.phase, f.frame, f.followUp, f.canceled], `n=${n}`).toEqual(['236LP>K', 'startup', 0, true, undefined]);
    }
  });

  it('236LP>K は押したフレームから発生前 12 で持続に入る。236LP の 50 フレーム目には当たらない', () => {
    const r = LP236([[25, b(5, 'LK')]]);
    expect([r.at(36).fighter.phase, r.at(37).fighter.phase, r.at(37).fighter.move?.input]).toEqual(['startup', 'active', '236LP>K']);
    expect(r.contactFrames()).toEqual([]); // キャノンストライクは反応のデータがない
  });

  it('受付の中で 2 + K（K にも 2K にも合う）→ 方向つきが優先で 236LP>2K（リバースエッジ、発生前 17）。5 + K なら 236LP>K', () => {
    const f = LP236([[30, b(2, 'LK')]]).at(30).fighter;
    expect([f.move?.input, f.phase, f.frame, f.followUp]).toEqual(['236LP>2K', 'startup', 0, true]);
    expect(LP236([[30, b(2, 'LK')]]).at(47).fighter.phase).toBe('active');
    expect(LP236([[30, b(5, 'LK')]]).at(30).fighter.move?.input).toBe('236LP>K');
  });

  it('40 以降（41 フレーム目以降）の K は派生にならず、236LP のまま 49 で当たる', () => {
    for (const n of [40, 41, 45]) {
      const r = LP236([[n, b(5, 'LK')]]);
      expect(r.followUpFrames(), `n=${n}`).toEqual([]);
      for (let k = n; k <= 48; k++) expect(r.at(k).fighter.move?.input, `n=${n} k=${k}`).toBe('236LP');
      expect(r.contactFrames()[0], `n=${n}`).toBe(49);
    }
  });

  it('236MP・236HP も同じ 4 つの派生（K）が出て、派生なしの自動の動き（発生前 49）も同じ', () => {
    for (const btn of ['MP', 'HP']) {
      const f = play([...c236(0, btn), [22, b(5, 'MK')]], 60, 'hit', 'cammy').at(22).fighter;
      expect([f.move?.input, f.followUp], btn).toEqual([`236${btn}>K`, true]);
      expect(play(c236(0, btn), 100, 'hit', 'cammy').contactFrames(), btn).toEqual([49]);
    }
  });

  it('派生は先行入力より優先する: 受付の中の LP（同時に 5LP が選ばれる入力）でも、派生 P（サイレントステップ）が出る', () => {
    const f = LP236([[30, b(5, 'LP')]]).at(30).fighter;
    expect([f.move?.input, f.followUp]).toEqual(['236LP>P', true]);
  });
});

describe('投げの派生 236LP>LPLK (第17段階 受け入れ条件 5)', () => {
  it('LP と LK の同時押しで 236LP>LPLK が出て、相手が「ガード」でもヒットの反応（ダウン）になる', () => {
    const r = play([...c236(0, 'LP'), [25, b(5, 'LP', 'LK')]], 100, 'block', 'cammy');
    const f = r.at(25).fighter;
    expect([f.move?.input, f.phase, f.frame, f.followUp]).toEqual(['236LP>LPLK', 'startup', 0, true]);
    // 発生前 9 → 34 で持続に入る
    expect([r.at(33).fighter.phase, r.at(34).fighter.phase]).toEqual(['startup', 'active']);
    expect(r.contactFrames()).toEqual([34]);
    expect(r.at(34).dummy.phase).toBe('down');
    expect(r.at(34).contact).toMatchObject({ kind: 'hit', knockdown: true, advantage: 18 });
  });

  it('LP を先に押して押し続け、あとから LK を足す（どちらかが新しい）でも LPLK の派生になる', () => {
    const r = play([...c236(0, 'LP'), [15, b(5, 'LP')], [16, b(5, 'LP')], [25, b(5, 'LP', 'LK')]], 100, 'hit', 'cammy');
    const f = r.at(25).fighter;
    expect([f.move?.input, f.followUp]).toEqual(['236LP>LPLK', true]);
  });

  it('ヒットの相手でもダウンになる', () => {
    const r = play([...c236(0, 'LP'), [25, b(5, 'LP', 'LK')]], 100, 'hit', 'cammy');
    expect(r.at(34).dummy.phase).toBe('down');
  });

  it('LP だけの押しは LPLK にならない（P の派生）', () => {
    const f = play([...c236(0, 'LP'), [25, b(5, 'LP')]], 60, 'hit', 'cammy').at(25).fighter;
    expect(f.move?.input).toBe('236LP>P');
  });
});

describe('攻撃なしの派生 236LP>P (第17段階 受け入れ条件 6)', () => {
  it('236LP>P は持続に入っても相手に当たらない（contact なし、相手は free のまま）', () => {
    for (const mode of ['hit', 'block'] as DummyMode[]) {
      const r = play([...c236(0, 'LP'), [25, b(5, 'LP')]], 80, mode, 'cammy');
      expect(r.at(25).fighter.move?.input, mode).toBe('236LP>P');
      expect(r.at(26).fighter.phase, mode).toBe('active'); // 発生前 1
      expect(r.at(26).fighter.move?.input, mode).toBe('236LP>P');
      expect(r.contactFrames(), mode).toEqual([]);
      expect(r.frames().every((f) => f.fighter.contact === undefined), mode).toBe(true);
      expect(r.at(26).dummy.phase, mode).toBe('free');
    }
  });
});

// ---------------------------------------------------------------- 受け入れ条件 8: コンボトライアル

describe('コンボトライアルの派生の手 (第17段階 受け入れ条件 8)', () => {
  function recipeOf(texts: string[], rules: NotationRules): ComboRecipe {
    const r = parseRecipe(
      { id: 'r', name: 'r', steps: texts.map((input, i) => (i === 0 ? { input } : { input, window: [0, 15] })) },
      rules,
    );
    if (!r.ok) throw new Error(`レシピが読めません: ${r.error}`);
    return r.recipe;
  }

  function run(texts: string[], entries: Entries, length: number, name: Who) {
    const { c, rules } = who[name];
    const moves = resolveRecipe(recipeOf(texts, rules), c.data, rules);
    if (moves === null) throw new Error('resolveRecipe が null です');
    const inputs: FrameInput[] = Array.from({ length: ORIGIN + length }, () => N);
    for (const [f, input] of entries) inputs[ORIGIN + f] = input;
    let fighter: FighterState = INITIAL_FIGHTER;
    let dummy: DummyState = INITIAL_DUMMY;
    let state = initialSimTrial();
    const history: FrameInput[] = [];
    const events: [number, SimTrialEvent][] = [];
    inputs.forEach((input, i) => {
      history.push(input);
      const stepped = stepFighter(fighter, history, c, rules, INPUT_BUFFER);
      const r = stepDummy(dummy, stepped, 'hit');
      const sim: SimFrame = { frame: i, before: fighter, after: r.fighter, dummyBefore: dummy, dummyAfter: r.dummy, contact: r.contact };
      const out = stepSimTrial(state, moves, sim, INPUT_BUFFER);
      state = out.state;
      if (out.event) events.push([i - ORIGIN, out.event]);
      fighter = r.fighter;
      dummy = r.dummy;
    });
    return { events };
  }
  const timing = (offset: number, window: number) => ({ offset, window });

  it('resolveRecipe: 5HP → 5HP>HK は、2 手目の技の一覧が 5HP>HK だけ', () => {
    const { c, rules } = who.cammy;
    const moves = resolveRecipe(recipeOf(['5HP', '5HP>HK'], rules), c.data, rules);
    expect(moves?.map((l) => l.map((m) => m.input))).toEqual([['5HP'], ['5HP>HK']]);
  });

  it('resolveRecipe: 最後でない手の派生がヒット硬直にならない（5HP>HK はダウン）なら null。最後ならよい', () => {
    const { c, rules } = who.cammy;
    expect(resolveRecipe(recipeOf(['5HP', '5HP>HK', '5LP'], rules), c.data, rules)).toBeNull();
    expect(resolveRecipe(recipeOf(['5HP', '5HP>HK'], rules), c.data, rules)).not.toBeNull();
  });

  it('resolveRecipe: 最後の手でも、攻撃のない技（noHitbox）しか当たらない手があれば null（5HP → 236P>P）。236P>2K は null でない', () => {
    const { c, rules } = who.cammy;
    expect(resolveRecipe(recipeOf(['5HP', '236P>P'], rules), c.data, rules)).toBeNull();
    expect(resolveRecipe(recipeOf(['5HP', '236P>2K'], rules), c.data, rules)).not.toBeNull();
  });

  it('resolveRecipe: ブリジット 2HS → 236K~P は、2 手目の技の一覧が 236K~P だけ（親の 236K は入らない）', () => {
    const { c, rules } = who.bridget;
    const moves = resolveRecipe(recipeOf(['2HS', '236K~P'], rules), c.data, rules);
    expect(moves?.map((l) => l.map((m) => m.input))).toEqual([['2HS'], ['236K~P']]);
  });

  it('キャミィ 5HP → 5HP>HK: ヒットストップ中の 10 で HK を押すと完走。5HP は 7、派生は 33 で当たる。2 手目は最速 +3（当たった 7 から）、猶予 19F', () => {
    const r = run(['5HP', '5HP>HK'], [[0, b(5, 'HP')], [10, b(5, 'HK')]], 80, 'cammy');
    expect(r.events).toEqual([
      [7, { type: 'hit', stepIndex: 0, timing: null }],
      [33, { type: 'complete', stepIndex: 1, timing: timing(3, 19) }],
    ]);
  });

  it('5HP → 5HP>HK: 受付の最後（25）に押すと +18、猶予 19F で完走', () => {
    const r = run(['5HP', '5HP>HK'], [[0, b(5, 'HP')], [25, b(5, 'HK')]], 80, 'cammy');
    expect(r.events[1]).toEqual([37, { type: 'complete', stepIndex: 1, timing: timing(18, 19) }]);
  });

  it('5HP → 5HP>HK: 当たったフレーム（7）に押すと完走。timing は { offset: 0, window: 19 }、派生は 21 から出て 33 で当たる', () => {
    const r = run(['5HP', '5HP>HK'], [[0, b(5, 'HP')], [7, b(5, 'HK')]], 80, 'cammy');
    expect(r.events).toEqual([
      [7, { type: 'hit', stepIndex: 0, timing: null }],
      [33, { type: 'complete', stepIndex: 1, timing: timing(0, 19) }],
    ]);
  });

  it('5HP → 5HP>HK: 当たる前（6）に押しても完走しない', () => {
    const r = run(['5HP', '5HP>HK'], [[0, b(5, 'HP')], [6, b(5, 'HK')]], 80, 'cammy');
    expect(r.events.some(([, e]) => e.type === 'complete')).toBe(false);
  });

  it('5HP → 5HP>HK: 26 に押すと間に合わず、完走しない', () => {
    const r = run(['5HP', '5HP>HK'], [[0, b(5, 'HP')], [26, b(5, 'HK')]], 80, 'cammy');
    expect(r.events.some(([, e]) => e.type === 'complete')).toBe(false);
  });

  it('ブリジット 2HS → 236K~P: 2HS のキャンセルで出した 236K が始まっても「違う技」にならず、236K~P で完走する（猶予 25F）', () => {
    // 2HS は 10 で当たり 11〜24 が止まる。236K は 25 から出て、34 で持続に入る（発生前 9）。受付は 236K の 10〜34 フレーム目 = 34〜58。
    // 236K のヒットストップ（35〜47）が明けた 48 に P を押すと、48 から 236K~P（発生前 6）で 54 に持続に入る。受付の始まり 34 から +14
    const r = run(['2HS', '236K~P'], [[0, b(2, 'HS')], ...c236(15, 'K'), [48, b(5, 'P')]], 100, 'bridget');
    expect(r.events.some(([, e]) => e.type === 'drop')).toBe(false);
    expect(r.events).toEqual([
      [10, { type: 'hit', stepIndex: 0, timing: null }],
      [54, { type: 'complete', stepIndex: 1, timing: timing(14, 25) }],
    ]);
  });

  it('ブリジット 2HS → 236K~P: 236K のまま P を押さなければ完走しない（違う技の失敗にもならない）', () => {
    const r = run(['2HS', '236K~P'], [[0, b(2, 'HS')], ...c236(15, 'K')], 100, 'bridget');
    expect(r.events.some(([, e]) => e.type === 'complete')).toBe(false);
    expect(r.events.some(([, e]) => e.type === 'drop' && e.reason === 'wrong')).toBe(false);
  });
});

// ---------------------------------------------------------------- 受け入れ条件 9: judgeFollowUp

describe('judgeFollowUp (第17段階 受け入れ条件 9)', () => {
  const DOWN: DummyState = { phase: 'down', remaining: 500 };
  const brake = followOf('bridget', '236K', 'P');
  const swing = followOf('cammy', '5HP', 'HK');
  const k236 = moveOf('bridget', '236K');
  const hp5 = moveOf('cammy', '5HP');
  /** 236K（相手はダウン中で当たらない）のあと、n で P を押したフレームの判定 */
  const bridgetAt = (n: number | null) => {
    const r = play([...c236(0, 'K'), ...(n === null ? [] : ([[n, b(5, 'P')]] as Entries))], 80, 'hit', 'bridget', DOWN);
    return (k: number) => judgeFollowUp(r.at(k - 1).fighter, r.at(k).fighter, k236, brake);
  };
  const cammyAt = (press: number, dummy: DummyState = INITIAL_DUMMY, first: FrameInput = b(5, 'HP')) => {
    const r = play([[0, first], [press, b(5, 'HK')]], 80, 'hit', 'cammy', dummy);
    return judgeFollowUp(r.at(press - 1).fighter, r.at(press).fighter, hp5, swing);
  };

  it('ok: 受付の中（9・15・33）で押すと、その派生が始まっている', () => {
    for (const n of [9, 15, 33]) expect(bridgetAt(n)(n), `n=${n}`).toEqual({ ok: true });
  });

  it('noParent: 技を出していないとき（P を押しただけ）', () => {
    const r = play([[5, b(5, 'P')]], 30, 'hit', 'bridget', DOWN);
    expect(judgeFollowUp(r.at(4).fighter, r.at(5).fighter, k236, brake)).toEqual({ ok: false, reason: 'noParent' });
  });

  it('noParent: 出している技が親でないとき（5LP の途中で HK）', () => {
    expect(cammyAt(3, INITIAL_DUMMY, b(5, 'LP'))).toEqual({ ok: false, reason: 'noParent' });
  });

  it('early: 受付の前。from − n フレーム（8 なら 1、5 なら 4）', () => {
    expect(bridgetAt(8)(8)).toEqual({ ok: false, reason: 'early', frames: 1 });
    expect(bridgetAt(5)(5)).toEqual({ ok: false, reason: 'early', frames: 4 });
  });

  it('late: 受付のあと。n − to フレーム（34 なら 1、36 なら 3）', () => {
    expect(bridgetAt(34)(34)).toEqual({ ok: false, reason: 'late', frames: 1 });
    expect(bridgetAt(36)(36)).toEqual({ ok: false, reason: 'late', frames: 3 });
  });

  it('ok（contact）: 5HP が当たったあと、ヒットストップ中（10）と受付の最後（25）', () => {
    expect(cammyAt(10)).toEqual({ ok: true });
    expect(cammyAt(25)).toEqual({ ok: true });
  });

  it('ok（contact）: 当たったフレーム（7）に押した判定も ok（after の contactAge が 1）。当たる前（6）は noContact', () => {
    expect(cammyAt(7)).toEqual({ ok: true });
    expect(cammyAt(6)).toEqual({ ok: false, reason: 'noContact' });
  });

  it('late（contact）: 当たったフレームを 1 として 19 を超えたら、超えた分（26 なら 1、28 なら 3）', () => {
    expect(cammyAt(26)).toEqual({ ok: false, reason: 'late', frames: 1 });
    expect(cammyAt(28)).toEqual({ ok: false, reason: 'late', frames: 3 });
  });

  it('noContact: 5HP が当たっていない（相手がダウン中）', () => {
    expect(cammyAt(10, DOWN)).toEqual({ ok: false, reason: 'noContact' });
    expect(cammyAt(25, DOWN)).toEqual({ ok: false, reason: 'noContact' });
  });

  it('other: 受付の中でも、その派生ではない技が出たとき（236LP>K を判定して 2 + K → 236LP>2K が出る）。その派生そのものなら ok', () => {
    const parent = moveOf('cammy', '236LP');
    const cannon = followOf('cammy', '236LP', 'K');
    const at = (press: FrameInput, fu: typeof cannon) => {
      const r = play([...c236(0, 'LP'), [30, press]], 80, 'hit', 'cammy');
      return { j: judgeFollowUp(r.at(29).fighter, r.at(30).fighter, parent, fu), out: r.at(30).fighter.move?.input };
    };
    expect(at(b(2, 'LK'), cannon)).toEqual({ j: { ok: false, reason: 'other' }, out: '236LP>2K' });
    expect(at(b(5, 'LK'), cannon)).toEqual({ j: { ok: true }, out: '236LP>K' });
  });

  it('other: 236LP>P を判定して LP + LK 同時 → 236LP>LPLK が出る。LP だけなら ok', () => {
    const parent = moveOf('cammy', '236LP');
    const silent = followOf('cammy', '236LP', 'P');
    const at = (press: FrameInput) => {
      const r = play([...c236(0, 'LP'), [30, press]], 80, 'hit', 'cammy');
      return { j: judgeFollowUp(r.at(29).fighter, r.at(30).fighter, parent, silent), out: r.at(30).fighter.move?.input };
    };
    expect(at(b(5, 'LP', 'LK'))).toEqual({ j: { ok: false, reason: 'other' }, out: '236LP>LPLK' });
    expect(at(b(5, 'LP'))).toEqual({ j: { ok: true }, out: '236LP>P' });
  });

  it('ヒットストップで止まっている 236K の受付の判定も、止まっていたフレームを数えない（番号 33 の 46 は ok、47 は late 1）', () => {
    const run = (n: number) => {
      const r = play([...c236(0, 'K'), [n, b(5, 'P')]], 90, 'hit', 'bridget');
      return judgeFollowUp(r.at(n - 1).fighter, r.at(n).fighter, k236, brake);
    };
    expect(run(46)).toEqual({ ok: true });
    expect(run(47)).toEqual({ ok: false, reason: 'late', frames: 1 });
    expect(run(15)).toEqual({ ok: true }); // 止まっている間は予約
  });
});
