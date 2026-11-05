import { msg } from '../i18n/messages';
import type { FighterState } from '../core/fighter';
import type { MoveFrames } from '../core/frameData';

export interface StageView {
  /** 状態を描く。前に描いた state と同じ参照で、大きさも変わっていなければ何もしない。airFrames はジャンプの空中のフレーム数 */
  render(state: FighterState, airFrames: number): void;
}

const HEIGHT = 160;
const FLOOR_Y = 132;
/** 棒人間の色は 2 色。線と、攻撃が当たる手足 */
const LINE = '#e8e8e8';
const ACTIVE = '#ff6b6b';
const LINE_WIDTH = 3;
/** ジャンプの高さ（px） */
const JUMP_HEIGHT = 80;

/** P 系（腕で出す技）か。それ以外（K・S・HS・D 系）は脚 */
function isPunch(move: MoveFrames): boolean {
  return move.input.endsWith('P');
}

/**
 * 横長のステージに、右向き固定の棒人間を描く（線だけ）。
 * 描き直しは、状態か大きさが変わったときだけ。呼ぶのは 1 回の rAF に 1 回まで（main.ts）
 */
export function createStageView(root: HTMLElement): StageView {
  const section = document.createElement('section');
  section.className = 'stage-panel';
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-canvas';
  canvas.height = HEIGHT;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', msg().stageLabel);
  section.append(canvas);
  root.append(section);
  const ctx = canvas.getContext('2d');

  let drawn: FighterState | null = null;
  let drawnAir = -1;
  /** 大きさが変わったら true（ResizeObserver で知る。毎フレーム clientWidth を読まないため） */
  let dirty = true;
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => (dirty = true)).observe(canvas);

  /** 線を 1 本（beginPath と stroke は呼び出し側） */
  const seg = (ax: number, ay: number, bx: number, by: number): void => {
    if (ctx === null) return;
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  };

  /** 体を描く。hip は腰の高さ（立ちは 36、しゃがみは 20）。(fx, fy) は足元の中心 */
  function body(fx: number, fy: number, hipH: number, lean: number): { hipX: number; hipY: number; shX: number; shY: number } {
    if (ctx === null) return { hipX: 0, hipY: 0, shX: 0, shY: 0 };
    const hipX = fx;
    const hipY = fy - hipH;
    const shX = fx + lean;
    const shY = hipY - 26;
    ctx.beginPath();
    seg(hipX, hipY, shX, shY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(shX + lean * 0.3, shY - 10, 9, 0, Math.PI * 2);
    ctx.stroke();
    return { hipX, hipY, shX, shY };
  }

  /** 脚を 2 本。(f1x, f1y)・(f2x, f2y) は足の先。膝は腰と足の間で少し前に出す */
  function legs(hipX: number, hipY: number, f1x: number, f1y: number, f2x: number, f2y: number, bend: number): void {
    if (ctx === null) return;
    ctx.beginPath();
    seg(hipX, hipY, (hipX + f1x) / 2 + bend, (hipY + f1y) / 2);
    seg((hipX + f1x) / 2 + bend, (hipY + f1y) / 2, f1x, f1y);
    seg(hipX, hipY, (hipX + f2x) / 2 + bend, (hipY + f2y) / 2);
    seg((hipX + f2x) / 2 + bend, (hipY + f2y) / 2, f2x, f2y);
    ctx.stroke();
  }

  /** 腕を 1 本。肘は手と肩の間で少し下 */
  function arm(shX: number, shY: number, hx: number, hy: number, elbowDrop: number): void {
    if (ctx === null) return;
    const ex = (shX + hx) / 2;
    const ey = (shY + hy) / 2 + elbowDrop;
    ctx.beginPath();
    seg(shX, shY, ex, ey);
    seg(ex, ey, hx, hy);
    ctx.stroke();
  }

  function drawFigure(s: FighterState, px: number, airFrames: number): void {
    if (ctx === null) return;
    ctx.lineWidth = LINE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = LINE;
    const m = s.move;
    const low = m !== null && m.input.startsWith('2');
    switch (s.phase) {
      case 'crouch':
      case 'prejump':
      case 'landing': {
        const b = body(px, FLOOR_Y, 20, 6);
        legs(b.hipX, b.hipY, px - 12, FLOOR_Y, px + 14, FLOOR_Y, 16);
        arm(b.shX, b.shY, b.shX + 16, b.shY + 10, 4);
        break;
      }
      case 'air': {
        const t = Math.min(1, s.frame / Math.max(1, airFrames));
        const up = 4 * JUMP_HEIGHT * t * (1 - t);
        const fy = FLOOR_Y - up;
        const b = body(px, fy, 28, 2);
        legs(b.hipX, b.hipY, px - 10, fy - 8, px + 12, fy - 12, 14);
        arm(b.shX, b.shY, b.shX + 14, b.shY - 6, 4);
        break;
      }
      case 'walkForward':
      case 'walkBack': {
        const sway = Math.sin(s.frame * 0.4) * 14 * (s.phase === 'walkForward' ? 1 : -1);
        const b = body(px, FLOOR_Y, 36, 2);
        legs(b.hipX, b.hipY, px + sway, FLOOR_Y, px - sway, FLOOR_Y, 2);
        arm(b.shX, b.shY, b.shX + 14, b.shY + 14, 4);
        break;
      }
      case 'startup':
      case 'active':
      case 'recovery': {
        if (m === null) break;
        // 構え → 伸ばす → 戻す。reach は 0（引いた形）〜 1（いっぱいに伸ばした形）
        const reach =
          s.phase === 'startup' ? 0 : s.phase === 'active' ? 1 : 1 - (s.frame + 1) / Math.max(1, m.recovery);
        const hipH = low ? 20 : 36;
        const b = body(px, FLOOR_Y, hipH, low ? 6 : 4 + reach * 4);
        const punch = isPunch(m);
        const active = s.phase === 'active';
        // 使わない側の手足
        if (punch) {
          legs(b.hipX, b.hipY, px - 12, FLOOR_Y, px + 12, FLOOR_Y, low ? 14 : 4);
          arm(b.shX, b.shY, b.shX + 6, b.shY + 12, 4);
        } else {
          arm(b.shX, b.shY, b.shX + 14, b.shY + 8, 4);
          legs(b.hipX, b.hipY, px - 12, FLOOR_Y, px - 12, FLOOR_Y, 0);
        }
        // 技の手足
        if (active) ctx.strokeStyle = ACTIVE;
        if (punch) {
          arm(b.shX, b.shY, b.shX + 8 + reach * 30, b.shY + 8 - reach * 8, (1 - reach) * 8);
        } else {
          const kx = b.hipX + 10 + reach * 30;
          const ky = b.hipY + 12 - reach * 12 + (low ? 4 : 0);
          legs(b.hipX, b.hipY, kx, Math.min(FLOOR_Y, ky), kx, Math.min(FLOOR_Y, ky), (1 - reach) * 8);
        }
        break;
      }
      default: {
        // idle
        const b = body(px, FLOOR_Y, 36, 2);
        legs(b.hipX, b.hipY, px - 10, FLOOR_Y, px + 10, FLOOR_Y, 2);
        arm(b.shX, b.shY, b.shX + 16, b.shY + 10, 4);
      }
    }
  }

  return {
    render(state, airFrames) {
      if (ctx === null) return;
      if (state === drawn && airFrames === drawnAir && !dirty) return;
      const cssWidth = canvas.clientWidth;
      // 隠れているとき（幅 0）は描かない。見えたときに大きさの変化として知らされる
      if (cssWidth === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(cssWidth * dpr);
      const h = Math.round(HEIGHT * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      dirty = false;
      drawn = state;
      drawnAir = airFrames;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, HEIGHT);
      // 床
      ctx.lineWidth = 2;
      ctx.strokeStyle = LINE;
      ctx.beginPath();
      ctx.moveTo(0, FLOOR_Y + 1);
      ctx.lineTo(cssWidth, FLOOR_Y + 1);
      ctx.stroke();
      drawFigure(state, state.x * cssWidth, airFrames);
    },
  };
}
