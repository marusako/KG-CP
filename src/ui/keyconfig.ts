import type { Device } from '../input/activeDevice';
import type { GameProfile } from '../core/profiles';
import { actionsFor, assignKey, assignPad, saveBindings, type Action, type Bindings } from '../input/bindings';
import type { PadDir } from '../input/captureFilter';
import { resolveDirection, type PressedDirs } from '../input/direction';
import type { PadInfo } from '../input/gamepad';
import type { KeyboardReader } from '../input/keyboard';
import { keyLabel } from '../input/keyLabel';
import { detectPadFamily, padButtonLabel, padDisplayName, type PadFamily } from '../input/padLayout';
import { actionName, startWizard, wizardPress, wizardResult, type WizardState, type WizardTarget } from '../input/wizard';
import { createKeyboardDiagram, createPadDiagram } from './diagrams';

export interface KeyConfig {
  /** パッドのボタンが押された瞬間に呼ぶ。入力待ち・一括設定中なら割り当てに使う */
  readonly onPadButton: (index: number) => void;
  /** 操作中のデバイスが変わったときに呼ぶ */
  readonly setDevice: (device: Device) => void;
  /** 毎フレーム、接続中のパッドの読み取りを渡す。押している状態が変わったときだけ図を書き換える */
  readonly update: (pads: readonly PadInfo[]) => void;
  /** 一括設定中か個別の入力待ち中か（その間の入力はゲームに使わない） */
  readonly isCapturing: () => boolean;
  /** 入力待ち・一括設定を、割り当てを変えずに終える（表示も元に戻す）。捕まえ中でなければ何もしない */
  readonly cancel: () => void;
  /** ゲームを切り替える。一覧・図・まとめて設定をそのゲームのボタンにし、捕まえ中なら取り消す */
  readonly setProfile: (profile: GameProfile, bindings: Bindings) => void;
}

type ViewMode = 'auto' | WizardTarget;

const ARROWS: Readonly<Record<number, string>> = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
const PAD_DIR_BUTTONS: Readonly<Record<PadDir, number>> = { up: 12, down: 13, left: 14, right: 15 };
const GUIDE = '操作の名前をクリックすると、その操作だけ直せます（Esc で取り消し）。';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createKeyConfig(
  root: HTMLElement,
  initialProfile: GameProfile,
  initialBindings: Bindings,
  keyboard: KeyboardReader,
): KeyConfig {
  let profile = initialProfile;
  let bindings = initialBindings;
  const isButtonAction = (a: Action): boolean => profile.buttons.includes(a);

  const section = el('section', 'keyconfig');
  const deviceLine = el('div', 'kc-device');
  const tabs = el('div', 'kc-tabs');
  const prompt = el('div', 'kc-prompt');
  const body = el('div', 'kc-body');
  const diagramBox = el('div', 'kc-diagram');
  const side = el('div', 'kc-side');
  const readout = el('div', 'kc-readout');
  const actionList = el('div', 'kc-actions');
  const missing = el('div', 'note');
  const controls = el('div', 'kc-controls');
  const note = el('div', 'note');
  const wizardButton = el('button', undefined, 'まとめて設定');
  const cancelButton = el('button', undefined, '取り消し');
  const modeButtons: readonly (readonly [ViewMode, HTMLButtonElement])[] = [
    ['keyboard', el('button', undefined, 'キーボード')],
    ['pad', el('button', undefined, 'パッド')],
    ['auto', el('button', undefined, '自動')],
  ];
  tabs.append(...modeButtons.map(([, b]) => b));
  controls.append(wizardButton, cancelButton);
  side.append(readout, actionList);
  const padDiagram = createPadDiagram();
  const keyboardDiagram = createKeyboardDiagram();
  body.append(diagramBox, side);
  const title = el('h2', undefined, 'キーコンフィグ');
  section.append(title, deviceLine, tabs, prompt, body, missing, controls, note);
  root.append(section);

  let device: Device = { kind: 'keyboard' };
  let mode: ViewMode = 'auto';
  let pads: readonly PadInfo[] = [];
  const held = new Set<string>();
  let wizard: WizardState | null = null;
  let waiting: Action | null = null;
  /** 入力待ちの間、図とリストを固定する */
  let lock: WizardTarget | null = null;
  let message = GUIDE;
  let messageError = false;
  let shownSignature = '';

  const viewKind = (): WizardTarget => lock ?? (mode === 'auto' ? device.kind : mode);
  const capturing = (): boolean => wizard !== null || waiting !== null;
  const viewPad = (): PadInfo | undefined => {
    const d = device;
    return (d.kind === 'pad' ? pads.find((p) => p.index === d.index) : undefined) ?? pads[0];
  };
  const padFamily = (): PadFamily => {
    if (device.kind === 'pad') return device.family;
    const p = pads[0];
    return p ? detectPadFamily(p.id, p.mapping) : 'unknown';
  };

  /** 聞いている操作（一括設定中はその操作、個別の入力待ちならその操作） */
  const targetAction = (): Action | null => {
    if (wizard && !wizard.done) return wizard.actions[wizard.index] ?? null;
    return waiting;
  };

  /** 押している状態を図と「いまの入力」に反映する。値が変わったときだけ DOM を書き換える */
  const paintPressed = (): void => {
    const kind = viewKind();
    // まとめて設定の途中は、図の強調をやめて、一覧の聞いている操作だけを強調する
    const quiet = wizard !== null;
    let dirs: PressedDirs;
    let buttons: string[];
    let signature: string;
    if (kind === 'keyboard') {
      dirs = { up: false, down: false, left: false, right: false };
      buttons = [];
      for (const a of actionsFor(profile)) {
        if (!held.has(bindings.keys[a] as string)) continue;
        if (isButtonAction(a)) buttons.push(a);
        else dirs[a as keyof PressedDirs] = true;
      }
      signature = `k:${quiet ? '-' : ''}${[...held].sort().join(',')}`;
      keyboardDiagram.setPressed(quiet ? new Set() : held);
    } else {
      const p = viewPad();
      const pressed = new Set(p?.pressed ?? []);
      const stick = p?.stickDirs;
      dirs = {
        up: pressed.has(PAD_DIR_BUTTONS.up) || !!stick?.up,
        down: pressed.has(PAD_DIR_BUTTONS.down) || !!stick?.down,
        left: pressed.has(PAD_DIR_BUTTONS.left) || !!stick?.left,
        right: pressed.has(PAD_DIR_BUTTONS.right) || !!stick?.right,
      };
      buttons = profile.buttons.filter((b) => pressed.has(bindings.pad[b] as number));
      const sx = Math.round((p?.stick.x ?? 0) * 20);
      const sy = Math.round((p?.stick.y ?? 0) * 20);
      signature = `p:${quiet ? '-' : ''}${p?.index ?? '-'}:${[...pressed].join(',')}:${sx},${sy}`;
      padDiagram.setPressed(quiet ? new Set() : pressed);
      padDiagram.setStick(p?.stick.x ?? 0, p?.stick.y ?? 0);
    }
    if (signature === shownSignature) return;
    shownSignature = signature;
    const arrow = ARROWS[resolveDirection(dirs, 'neutral')] ?? '';
    const text = [arrow, ...buttons].filter((s) => s !== '').join(' + ');
    readout.textContent = `いまの入力（${kind === 'keyboard' ? 'キーボード' : 'パッド'}）: ${text === '' ? '―' : text}`;
  };

  const renderDeviceLine = (): void => {
    deviceLine.textContent =
      device.kind === 'keyboard'
        ? '操作中: キーボード'
        : `操作中: ${padDisplayName(device.id)}（${
            device.family === 'xbox' ? 'Xbox 式' : device.family === 'playstation' ? 'PlayStation 式' : 'ボタン番号表示'
          }）`;
  };

  const renderPrompt = (): void => {
    prompt.classList.remove('error');
    if (wizard && !wizard.done) {
      const a = wizard.actions[wizard.index]!;
      const what = wizard.target === 'keyboard' ? 'キー' : 'ボタン';
      prompt.textContent = `${actionName(a)} に使う${what}を押してください（${wizard.index + 1}/${wizard.actions.length}）`;
      if (wizard.error) {
        prompt.textContent += ` ${wizard.error}`;
        prompt.classList.add('error');
      }
    } else if (waiting) {
      prompt.textContent = `${actionName(waiting)} に使うキーかボタンを押してください`;
    } else {
      prompt.textContent = '';
    }
  };

  /** 状態が変わったときの全体の描き直し（毎フレームは呼ばない） */
  const render = (): void => {
    const kind = viewKind();
    renderDeviceLine();
    renderPrompt();
    for (const [m, b] of modeButtons) b.classList.toggle('active', m === mode);
    diagramBox.replaceChildren(kind === 'keyboard' ? keyboardDiagram.svg : padDiagram.svg);
    wizardButton.textContent = kind === 'keyboard' ? 'まとめて設定（キーボード）' : 'まとめて設定（パッド）';
    wizardButton.disabled = capturing();
    cancelButton.hidden = !capturing();
    const target = targetAction();

    const keyMap = new Map<string, string>();
    const actions = actionsFor(profile);
    for (const a of actions) keyMap.set(bindings.keys[a] as string, actionName(a));
    keyboardDiagram.setAssigned(keyMap);
    keyboardDiagram.setTarget(target && wizard === null ? (bindings.keys[target] ?? null) : null);
    const missingKeys = actions.filter((a) => !keyboardDiagram.has(bindings.keys[a] as string));
    missing.textContent =
      kind === 'keyboard' && missingKeys.length > 0
        ? `図にないキー: ${missingKeys.map((a) => `${keyLabel(bindings.keys[a] as string)} = ${actionName(a)}`).join('、')}`
        : '';

    const family = padFamily();
    padDiagram.setFamily(family);
    padDiagram.setAssigned(new Map(profile.buttons.map((b) => [bindings.pad[b] as number, b] as const)));
    padDiagram.setTarget(target && wizard === null && isButtonAction(target) ? (bindings.pad[target] ?? null) : null);

    actionList.replaceChildren();
    for (const a of kind === 'keyboard' ? actions : profile.buttons) {
      const b = el('button', a === target ? 'waiting' : undefined);
      const bound =
        kind === 'keyboard' || !isButtonAction(a)
          ? keyLabel(bindings.keys[a] as string)
          : padButtonLabel(family, bindings.pad[a] as number);
      b.textContent = `${actionName(a)}: ${bound}`;
      b.addEventListener('click', () => startSingle(a));
      actionList.append(b);
    }

    note.textContent = message;
    note.classList.toggle('error', messageError);
    shownSignature = '';
    paintPressed();
  };

  const say = (text: string, isError = false): void => {
    message = text;
    messageError = isError;
  };

  const blurFocus = (): void => {
    // フォーカスが残ると Enter/Space の割り当て時に click が誤発火するので外す
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  };

  const stopCapture = (): void => {
    wizard = null;
    waiting = null;
    lock = null;
    keyboard.captureNext = null;
  };

  const cancel = (): void => {
    if (!capturing()) return;
    stopCapture();
    say(GUIDE);
    render();
  };

  /** キーボードの次の 1 打鍵を受け取る。受け取るたびに自分で取り直す */
  const armKeyboard = (): void => {
    keyboard.captureNext = (code) => {
      if (code === 'Escape') {
        cancel();
        return;
      }
      if (wizard) {
        if (wizard.target === 'keyboard') applyWizard(code);
        // 一括設定が終わったあと（stopCapture 済み）は取り直さない
        if (wizard) armKeyboard();
        return;
      }
      if (waiting) {
        const a = waiting;
        const r = assignKey(bindings.keys, a, code);
        bindings.keys = r.keys;
        finishSingle(r.swappedWith ? `${actionName(r.swappedWith)}と入れ替えました` : GUIDE);
      }
    };
  };

  const applyWizard = (input: string | number): void => {
    if (!wizard) return;
    wizard = wizardPress(wizard, input);
    if (wizard.done) {
      const result = wizardResult(wizard, bindings);
      bindings.keys = result.keys;
      bindings.pad = result.pad;
      saveBindings(profile, bindings);
      stopCapture();
      say('設定しました');
    }
    render();
  };

  const finishSingle = (text: string): void => {
    stopCapture();
    saveBindings(profile, bindings);
    say(text);
    render();
  };

  function startSingle(a: Action): void {
    blurFocus();
    stopCapture();
    waiting = a;
    lock = viewKind();
    say(GUIDE);
    armKeyboard();
    render();
  }

  const startWizardFor = (): void => {
    blurFocus();
    stopCapture();
    const target = viewKind();
    wizard = startWizard(target, profile);
    lock = target;
    say(GUIDE);
    armKeyboard();
    render();
  };

  wizardButton.addEventListener('click', startWizardFor);
  cancelButton.addEventListener('click', () => {
    blurFocus();
    cancel();
  });
  for (const [m, b] of modeButtons) {
    b.addEventListener('click', () => {
      blurFocus();
      mode = m;
      render();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (held.has(e.code)) return;
    held.add(e.code);
    paintPressed();
  });
  window.addEventListener('keyup', (e) => {
    if (held.delete(e.code)) paintPressed();
  });
  window.addEventListener('blur', () => {
    held.clear();
    paintPressed();
  });

  render();

  return {
    onPadButton: (index) => {
      if (wizard) {
        if (wizard.target === 'pad') applyWizard(index);
        return;
      }
      if (waiting === null || !isButtonAction(waiting)) return;
      if (index >= 12 && index <= 15) {
        say('十字キーは方向に使うので、ボタンには割り当てられません', true);
        render();
        return;
      }
      const r = assignPad(bindings.pad, waiting, index);
      bindings.pad = r.pad;
      finishSingle(r.swappedWith ? `${actionName(r.swappedWith)}と入れ替えました` : GUIDE);
    },
    setDevice: (next) => {
      const changed =
        next.kind !== device.kind ||
        (next.kind === 'pad' && device.kind === 'pad' && (next.index !== device.index || next.id !== device.id));
      device = next;
      if (changed) render();
    },
    update: (next) => {
      pads = next;
      if (viewKind() === 'pad') paintPressed();
    },
    isCapturing: capturing,
    cancel,
    setProfile: (nextProfile, nextBindings) => {
      // 捕まえ中の表示も、割り当てを変えずに元へ戻す
      stopCapture();
      say(GUIDE);
      profile = nextProfile;
      bindings = nextBindings;
      render();
    },
  };
}
