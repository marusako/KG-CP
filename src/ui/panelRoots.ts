/** 練習のパネルを置く 2 つの枠。select は選ぶ一覧（右の枠）、status は判定の結果（真ん中の枠） */
export interface PanelRoots {
  readonly select: HTMLElement;
  readonly status: HTMLElement;
}
