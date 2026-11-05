import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
/** ひらがな・カタカナ・漢字。中黒（・ U+30FB）は記号として使う（ニュートラルの表示など）ので外す */
const JAPANESE = /[぀-ヺー-ヿ一-鿿]/;

/** 対象外: 文の表と、キャラの日本語名を持つデータのファイル */
const EXCLUDED = [join(SRC, 'i18n') + sep, join(SRC, 'core', 'characters.ts')];

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listTs(p));
    else if (e.isFile() && p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** \uXXXX と \u{...} の書き方を元の文字に戻す（書き方を変えてすり抜けないように） */
function decodeEscapes(s: string): string {
  return s.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, a: string | undefined, b: string | undefined) =>
    String.fromCodePoint(parseInt(a ?? b ?? '0', 16)),
  );
}

function hasJapanese(body: string): boolean {
  return JAPANESE.test(decodeEscapes(body));
}

/**
 * コメント（// と /* *\/）を飛ばし、文字列リテラル（' " `）の中身を取り出す。
 * テンプレートの ${ } の中も読み、入れ子の文字列リテラルも取り出す。
 * 戻り値は [始まりの行, リテラルの中身] の一覧（入れ子は外側より先に並ぶことがある）。
 */
function stringLiterals(src: string): [number, string][] {
  const out: [number, string][] = [];
  const n = src.length;
  let line = 1;
  let i = 0;

  const readQuoted = (quote: string): void => {
    const startLine = line;
    let body = '';
    i++;
    while (i < n && src[i] !== quote) {
      if (src[i] === '\\') {
        body += src[i]! + (src[i + 1] ?? '');
        if (src[i + 1] === '\n') line++;
        i += 2;
        continue;
      }
      if (src[i] === '\n') break; // 閉じ忘れ（正規表現の中の ' などの誤検出）は行末で打ち切る
      body += src[i];
      i++;
    }
    if (src[i] === quote) i++;
    out.push([startLine, body]);
  };

  const readTemplate = (): void => {
    const startLine = line;
    let body = '';
    i++;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') {
        body += src[i]! + (src[i + 1] ?? '');
        if (src[i + 1] === '\n') line++;
        i += 2;
        continue;
      }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2;
        body += '${}';
        scanCode(true);
        continue;
      }
      if (src[i] === '\n') line++;
      body += src[i];
      i++;
    }
    i++;
    out.push([startLine, body]);
  };

  /** コードを読む。stopAtBrace なら、対応する } を読んだところで戻る（テンプレートの ${ } の中） */
  const scanCode = (stopAtBrace: boolean): void => {
    let depth = 0;
    while (i < n) {
      const c = src[i]!;
      const d = src[i + 1];
      if (c === '\n') {
        line++;
        i++;
      } else if (c === '/' && d === '/') {
        while (i < n && src[i] !== '\n') i++;
      } else if (c === '/' && d === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++;
          i++;
        }
        i += 2;
      } else if (c === "'" || c === '"') {
        readQuoted(c);
      } else if (c === '`') {
        readTemplate();
      } else if (c === '{') {
        depth++;
        i++;
      } else if (c === '}') {
        i++;
        if (stopAtBrace && depth === 0) return;
        depth--;
      } else {
        i++;
      }
    }
  };

  scanCode(false);
  return out;
}

describe('src/ の文字列リテラルに日本語が残っていない (第7段階 受け入れ条件 9)', () => {
  const hitLines = (sample: string) =>
    stringLiterals(sample)
      .filter(([, s]) => hasJapanese(s))
      .map(([l]) => l)
      .sort((a, b) => a - b);

  it('チェッカー自体: コメントは無視し、文字列リテラルの日本語は見つける', () => {
    const sample = [
      "// コメントの日本語",
      "/* 複数行の",
      "   コメント */",
      "const a = 'ok';",
      "const b = 'こんにちは';",
      'const c = "カタカナ";',
      'const d = `漢字 ${1}`;',
    ].join('\n');
    expect(hitLines(sample)).toEqual([5, 6, 7]);
  });

  it('チェッカー自体: \\u の書き方で書いた日本語も見つける（第7段階 レビューの提案 4）', () => {
    const sample = ["const a = '\\u3042';", "const b = '\\u{30AB}';", "const ok = '\\u0041';"].join('\n');
    expect(hitLines(sample)).toEqual([1, 2]);
  });

  it('チェッカー自体: テンプレートの ${ } の中に入れ子にした文字列の日本語も見つける（第7段階 レビューの提案 4）', () => {
    const sample = [
      'const a = `x ${flag ? `入れ子` : \'\'} y`;',
      "const b = `${ { k: 'ひらがな' }.k }`;",
      'const c = `ok ${n}`;',
    ].join('\n');
    expect(hitLines(sample)).toEqual([1, 2]);
  });

  it('チェッカー自体: 中黒（・）だけの文字列は日本語として数えない', () => {
    expect(hitLines("const a = '・';")).toEqual([]);
  });

  it('対象のファイルがある（探し方が壊れていない）', () => {
    expect(listTs(SRC).length).toBeGreaterThan(10);
  });

  it('日本語を含む文字列リテラルがない（あれば「ファイル名:行」を一覧にする）', () => {
    const found: string[] = [];
    for (const file of listTs(SRC)) {
      if (EXCLUDED.some((x) => file === x || file.startsWith(x))) continue;
      const rel = relative(ROOT, file).split(sep).join('/');
      for (const [line, body] of stringLiterals(readFileSync(file, 'utf8'))) {
        if (hasJapanese(body)) found.push(`${rel}:${line}`);
      }
    }
    expect(found, `日本語の文字列リテラルが残っています:\n${found.join('\n')}`).toEqual([]);
  });
});
