/**
 * Verify shorthand Typst BẰNG compiler thật (v0.14.2): render `$ <shorthand> $`
 * và so glyph với render literal glyph tương ứng. Chỉ giữ shorthand nào khớp.
 * → bảng shorthand "đầy đủ" mà KHÔNG bịa (đối chiếu chéo docs ↔ compiler).
 */
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fontDir = resolve(here, '../var/fonts');
const compiler = NodeCompiler.create({ workspace: here, fontArgs: [{ fontPaths: [fontDir] }] });

const pre = `#set page(width: auto, height: auto, margin: 2pt)
#set text(font: "Times New Roman")
`;

function glyphPaths(svg) {
  // tập d="" của các <path> (glyph) — bỏ vị trí, chỉ so hình dạng.
  const ds = [...svg.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((m) => m[1]).sort();
  return ds.join('||');
}

function renderMath(inner) {
  const res = compiler.compile({ mainFileContent: `${pre}$ ${inner} $` });
  if (res.hasError()) return null;
  return glyphPaths(compiler.svg(res.result));
}
function renderMarkup(inner) {
  const res = compiler.compile({ mainFileContent: `${pre}${inner}` });
  if (res.hasError()) return null;
  return glyphPaths(compiler.svg(res.result));
}

// [shorthand, glyph kỳ vọng, ghi-chú]; whitespace (nbsp/shy) verify riêng = compile-OK.
const MATH = [
  ['...', '…'], ['-', '−'], ['*', '∗'], ['~', '∼'],
  ['!=', '≠'], [':=', '≔'], ['::=', '⩴'], ['=:', '≕'],
  ['<<', '≪'], ['<<<', '⋘'], ['>>', '≫'], ['>>>', '⋙'],
  ['<=', '≤'], ['>=', '≥'],
  ['->', '→'], ['-->', '⟶'], ['|->', '↦'], ['>->', '↣'], ['->>', '↠'],
  ['<-', '←'], ['<--', '⟵'], ['<-<', '↢'], ['<<-', '↞'],
  ['<->', '↔'], ['<-->', '⟷'],
  ['~>', '⇝'], ['~~>', '⟿'], ['<~', '⇜'], ['<~~', '⬳'],
  ['=>', '⇒'], ['|=>', '⤇'], ['==>', '⟹'], ['<==', '⟸'],
  ['<=>', '⇔'], ['<==>', '⟺'],
  ['[|', '⟦'], ['|]', '⟧'], ['||', '‖'],
];
const MARKUP = [
  ['...', '…'], ['--', '–'], ['---', '—'], ['-', '−'],
];
const WHITESPACE = [['~', 'nbsp (markup)'], ['-?', 'soft hyphen (markup)']];

let pass = 0, fail = 0;
console.log('=== MATH shorthands ===');
for (const [sh, g] of MATH) {
  const a = renderMath(sh);
  const b = renderMath(g);
  const ok = a && b && a === b;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(sh).padEnd(8)} → ${g}`);
  ok ? pass++ : fail++;
}
console.log('\n=== MARKUP shorthands ===');
for (const [sh, g] of MARKUP) {
  const a = renderMarkup(sh);
  const b = renderMarkup(g);
  const ok = a && b && a === b;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(sh).padEnd(8)} → ${g}`);
  ok ? pass++ : fail++;
}
console.log('\n=== WHITESPACE (chỉ kiểm tra biên dịch OK) ===');
for (const [sh, note] of WHITESPACE) {
  const res = compiler.compile({ mainFileContent: `${pre}A${sh}B` });
  const ok = !res.hasError();
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${JSON.stringify(sh).padEnd(8)} (${note})`);
  ok ? pass++ : fail++;
}
console.log(`\nTổng: ${pass} PASS, ${fail} FAIL`);
