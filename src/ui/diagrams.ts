import { keyLabel } from '../input/keyLabel';
import { padButtonLabel, type PadFamily } from '../input/padLayout';

const NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** 図のボタン 1 つぶんの配置。key はパッドならボタン番号、キーボードなら KeyboardEvent.code */
export interface CellSpec<K> {
  readonly key: K;
  readonly x: number;
  readonly y: number;
  /** 円なら r、四角なら w と h */
  readonly r?: number;
  readonly w?: number;
  readonly h?: number;
}

/** パッドの図の配置 1 つぶん。アケコンなどは別の PadLayout を作って createPadDiagram に渡せばよい */
export interface PadLayout {
  readonly cells: readonly CellSpec<number>[];
  readonly viewBox: string;
  /** 左スティックの中心と、点が動ける半径 */
  readonly stick: { readonly x: number; readonly y: number; readonly travel: number };
}

/** 標準の配置のパッド（番号は W3C Gamepad の Standard Gamepad） */
export const STANDARD_PAD_LAYOUT: PadLayout = {
  viewBox: '0 0 420 240',
  stick: { x: 100, y: 100, travel: 16 },
  cells: [
    { key: 0, x: 330, y: 150, r: 17 },
    { key: 1, x: 364, y: 116, r: 17 },
    { key: 2, x: 296, y: 116, r: 17 },
    { key: 3, x: 330, y: 82, r: 17 },
    { key: 4, x: 70, y: 36, w: 64, h: 20 },
    { key: 5, x: 286, y: 36, w: 64, h: 20 },
    { key: 6, x: 70, y: 8, w: 64, h: 24 },
    { key: 7, x: 286, y: 8, w: 64, h: 24 },
    { key: 8, x: 170, y: 90, r: 11 },
    { key: 9, x: 250, y: 90, r: 11 },
    { key: 10, x: 100, y: 100, r: 26 },
    { key: 11, x: 270, y: 180, r: 26 },
    { key: 12, x: 150, y: 150, w: 26, h: 26 },
    { key: 13, x: 150, y: 202, w: 26, h: 26 },
    { key: 14, x: 124, y: 176, w: 26, h: 26 },
    { key: 15, x: 176, y: 176, w: 26, h: 26 },
    { key: 16, x: 210, y: 60, r: 11 },
    { key: 17, x: 210, y: 130, w: 50, h: 22 },
  ],
};

const KEY = 38;
const GAP = 4;
const KEY_ROWS: readonly (readonly string[])[] = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'],
];
/** 段ごとの左のずらし（QWERTY 配列のずれに合わせる） */
const ROW_OFFSET = [0, 0.5, 0.75, 1.25];

function keyboardLayout(): CellSpec<string>[] {
  const cells: CellSpec<string>[] = [];
  KEY_ROWS.forEach((row, r) => {
    row.forEach((code, c) => {
      cells.push({ key: code, x: (c + ROW_OFFSET[r]!) * (KEY + GAP), y: r * (KEY + GAP), w: KEY, h: KEY });
    });
  });
  const ax = 11.5 * (KEY + GAP);
  cells.push({ key: 'ArrowUp', x: ax + KEY + GAP, y: 2 * (KEY + GAP), w: KEY, h: KEY });
  cells.push({ key: 'ArrowLeft', x: ax, y: 3 * (KEY + GAP), w: KEY, h: KEY });
  cells.push({ key: 'ArrowDown', x: ax + KEY + GAP, y: 3 * (KEY + GAP), w: KEY, h: KEY });
  cells.push({ key: 'ArrowRight', x: ax + 2 * (KEY + GAP), y: 3 * (KEY + GAP), w: KEY, h: KEY });
  return cells;
}
const KEYBOARD_LAYOUT = keyboardLayout();
const KEYBOARD_VIEWBOX = `-2 -2 ${15 * (KEY + GAP)} ${4 * (KEY + GAP) + 2}`;

/** ボタン 1 つの描画。値が変わったときだけ DOM を書き換える */
class Cell {
  readonly g: SVGGElement;
  private readonly nameText: SVGTextElement;
  private readonly assignedText: SVGTextElement;
  private name = '';
  private assigned = '';
  private pressed = false;
  private target = false;

  constructor(spec: CellSpec<unknown>) {
    this.g = svgEl('g', { class: 'dg-cell' });
    const cx = spec.r !== undefined ? spec.x : spec.x + (spec.w ?? 0) / 2;
    const cy = spec.r !== undefined ? spec.y : spec.y + (spec.h ?? 0) / 2;
    const shape =
      spec.r !== undefined
        ? svgEl('circle', { class: 'dg-shape', cx: spec.x, cy: spec.y, r: spec.r })
        : svgEl('rect', { class: 'dg-shape', x: spec.x, y: spec.y, width: spec.w ?? 0, height: spec.h ?? 0, rx: 5 });
    this.nameText = svgEl('text', { class: 'dg-name', x: cx, y: cy - 2, 'text-anchor': 'middle' });
    this.assignedText = svgEl('text', { class: 'dg-assigned', x: cx, y: cy + 11, 'text-anchor': 'middle' });
    this.g.append(shape, this.nameText, this.assignedText);
  }

  setName(v: string): void {
    if (v === this.name) return;
    this.name = v;
    this.nameText.textContent = v;
  }

  setAssigned(v: string): void {
    if (v === this.assigned) return;
    this.assigned = v;
    this.assignedText.textContent = v;
  }

  setPressed(v: boolean): void {
    if (v === this.pressed) return;
    this.pressed = v;
    this.g.classList.toggle('pressed', v);
  }

  setTarget(v: boolean): void {
    if (v === this.target) return;
    this.target = v;
    this.g.classList.toggle('target', v);
  }
}

function applySet<K>(cells: ReadonlyMap<K, Cell>, next: ReadonlySet<K>, apply: (c: Cell, on: boolean) => void): void {
  for (const [k, c] of cells) apply(c, next.has(k));
}

export interface PadDiagram {
  readonly svg: SVGSVGElement;
  setFamily(family: PadFamily): void;
  /** ボタン番号 → 重ねて書く操作名 */
  setAssigned(assigned: ReadonlyMap<number, string>): void;
  setPressed(pressed: ReadonlySet<number>): void;
  /** 左スティックの値（-1〜1） */
  setStick(x: number, y: number): void;
  /** 強調するボタン番号 */
  setTarget(index: number | null): void;
}

export function createPadDiagram(layout: PadLayout = STANDARD_PAD_LAYOUT): PadDiagram {
  const svg = svgEl('svg', { class: 'diagram', viewBox: layout.viewBox, role: 'img', 'aria-label': 'パッドの図' });
  const cells = new Map<number, Cell>();
  for (const spec of layout.cells) {
    const c = new Cell(spec);
    cells.set(spec.key, c);
    svg.append(c.g);
  }
  const dot = svgEl('circle', { class: 'dg-stick', cx: layout.stick.x, cy: layout.stick.y, r: 6 });
  svg.append(dot);
  let family: PadFamily | null = null;
  let stickKey = '';
  const setFamily = (f: PadFamily): void => {
    if (f === family) return;
    family = f;
    // 名前が分からないときは、丸からはみ出さないよう図の中だけ番号にする
    for (const [i, c] of cells) c.setName(f === 'unknown' ? String(i) : padButtonLabel(f, i));
  };
  setFamily('unknown');
  return {
    svg,
    setFamily,
    setAssigned: (assigned) => {
      for (const [i, c] of cells) c.setAssigned(assigned.get(i) ?? '');
    },
    setPressed: (pressed) => applySet(cells, pressed, (c, on) => c.setPressed(on)),
    setStick: (x, y) => {
      const cx = Math.round((layout.stick.x + x * layout.stick.travel) * 10) / 10;
      const cy = Math.round((layout.stick.y + y * layout.stick.travel) * 10) / 10;
      const k = `${cx},${cy}`;
      if (k === stickKey) return;
      stickKey = k;
      dot.setAttribute('cx', String(cx));
      dot.setAttribute('cy', String(cy));
    },
    setTarget: (index) => {
      for (const [i, c] of cells) c.setTarget(i === index);
    },
  };
}

export interface KeyboardDiagram {
  readonly svg: SVGSVGElement;
  /** 図に描いてあるキーか */
  has(code: string): boolean;
  /** キーのコード → 重ねて書く操作名 */
  setAssigned(assigned: ReadonlyMap<string, string>): void;
  setPressed(pressed: ReadonlySet<string>): void;
  setTarget(code: string | null): void;
}

export function createKeyboardDiagram(layout: readonly CellSpec<string>[] = KEYBOARD_LAYOUT): KeyboardDiagram {
  const svg = svgEl('svg', { class: 'diagram keyboard', viewBox: KEYBOARD_VIEWBOX, role: 'img', 'aria-label': 'キーボードの図' });
  const cells = new Map<string, Cell>();
  for (const spec of layout) {
    const c = new Cell(spec);
    c.setName(keyLabel(spec.key));
    cells.set(spec.key, c);
    svg.append(c.g);
  }
  return {
    svg,
    has: (code) => cells.has(code),
    setAssigned: (assigned) => {
      for (const [k, c] of cells) c.setAssigned(assigned.get(k) ?? '');
    },
    setPressed: (pressed) => applySet(cells, pressed, (c, on) => c.setPressed(on)),
    setTarget: (code) => {
      for (const [k, c] of cells) c.setTarget(k === code);
    },
  };
}
