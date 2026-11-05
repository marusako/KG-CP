/** 一覧の上に置く検索欄。Escape で入力を終える（フォーカスが外れるまで、キー入力は練習の入力にならない） */
export function createSearchInput(placeholder: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'search-input';
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') input.blur();
  });
  return input;
}
