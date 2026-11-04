export interface KeyEvent {
  code: string;
  down: boolean;
  time: number;
}

/** キーイベントの列を、フレームごとの「押されていたコード」の集合に変える（DOM に依存しない） */
export class KeyTimeline {
  private pending: { e: KeyEvent; seq: number }[] = [];
  private seq = 0;
  private held = new Set<string>();

  /** イベントを積む。順番は time で並べ直す（time が同じなら積んだ順） */
  push(e: KeyEvent): void {
    this.pending.push({ e, seq: this.seq++ });
    this.pending.sort((a, b) => a.e.time - b.e.time || a.seq - b.seq);
  }

  /** time < frameEnd のイベントを取り出して反映し、このフレームで押されていたコードの集合を返す */
  sample(frameEnd: number): ReadonlySet<string> {
    return this.sampleDetailed(frameEnd).pressed;
  }

  /** sample に加えて、押されていない状態から押されたコード（fresh）も返す */
  sampleDetailed(frameEnd: number): { pressed: ReadonlySet<string>; fresh: ReadonlySet<string> } {
    const tapped = new Set<string>();
    let n = 0;
    while (n < this.pending.length && (this.pending[n] as { e: KeyEvent }).e.time < frameEnd) {
      const { e } = this.pending[n] as { e: KeyEvent };
      n++;
      if (e.down) {
        if (this.held.has(e.code)) continue;
        this.held.add(e.code);
        tapped.add(e.code);
      } else {
        this.held.delete(e.code);
      }
    }
    this.pending.splice(0, n);
    return { pressed: new Set([...this.held, ...tapped]), fresh: tapped };
  }

  /** 押下状態と積んだイベントを全部消す */
  clear(): void {
    this.pending = [];
    this.held.clear();
  }
}
