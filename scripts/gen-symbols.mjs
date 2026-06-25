/**
 * SINH symbols.ts ĐẦY ĐỦ cho bộ tra cứu — nguồn = chính trình biên dịch Typst
 * (@myriaddreamin/typst-ts-node-compiler, v0.14.2). Lấy mọi ký hiệu của mô-đun
 * `sym` cùng TẤT CẢ biến thể (modifier) qua repr(). Không bịa, khớp version.
 *
 * Chạy: cd backend && node scripts/gen-symbols.mjs
 * Đầu ra: Frontendtluscholareditor/src/app/features/help/reference/symbols.ts
 */
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const fontDir = resolve(here, '../var/fonts');
const outFile = resolve(here, '../../Frontendtluscholareditor/src/app/features/help/reference/symbols.ts');
const compiler = NodeCompiler.create({ workspace: here, fontArgs: [{ fontPaths: [fontDir] }] });

// ---- 1. Lấy base + repr từ compiler ----
const res = compiler.query(
  { mainFileContent: `#let d = dictionary(sym)\n#metadata(d.keys().map(k => (name: k, rep: repr(d.at(k))))) <dump>` },
  { selector: '<dump>', field: 'value' },
);
const rows = res[0];

// ---- 2. Parser repr(symbol) ----
function readString(s, i) {
  let out = '';
  i++;
  while (i < s.length) {
    const c = s[i];
    if (c === '\\') {
      const n = s[i + 1];
      if (n === 'u') {
        const m = /^\\u\{([0-9a-fA-F]+)\}/.exec(s.slice(i));
        if (m) { out += String.fromCodePoint(parseInt(m[1], 16)); i += m[0].length; continue; }
      }
      const map = { n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\', "'": "'" };
      out += map[n] ?? n;
      i += 2;
      continue;
    }
    if (c === '"') { i++; break; }
    out += c;
    i++;
  }
  return [out, i];
}
function parseVariants(rep) {
  const variants = [];
  const t = rep.trim();
  if (t[0] === '"') { const [g] = readString(t, 0); return [{ mod: '', glyph: g }]; }
  if (!t.startsWith('symbol(')) return variants;
  let i = 'symbol('.length;
  const end = t.lastIndexOf(')');
  while (i < end) {
    const c = t[i];
    if (' \n\r\t,'.includes(c)) { i++; continue; }
    if (c === '"') { const [g, ni] = readString(t, i); variants.push({ mod: '', glyph: g }); i = ni; continue; }
    if (c === '(') {
      i++;
      while (' \n\r\t'.includes(t[i])) i++;
      const [mod, i2] = readString(t, i); i = i2;
      while (' \n\r\t,'.includes(t[i])) i++;
      const [glyph, i3] = readString(t, i); i = i3;
      while (t[i] !== ')' && i < end) i++;
      i++;
      variants.push({ mod, glyph });
      continue;
    }
    i++;
  }
  return variants;
}

// ---- 3. Bản đồ nhóm (tên gốc → category). Tên thiếu → "misc". ----
const L = (s) => s.trim().split(/\s+/);
const CAT_LISTS = {
  'greek-lower': L('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega digamma kai sha'),
  'greek-upper': L('Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega Digamma Kai Sha'),
  hebrew: L('alef aleph bet beth gimel gimmel dalet daleth shin'),
  blackboard: L('AA BB CC DD EE FF GG HH II JJ KK LL MM NN OO PP QQ RR SS TT UU VV WW XX YY ZZ Im Re ell planck'),
  operators: L('plus minus times div ast dot star bullet compose convolve interleave join wreath smash amp'),
  bigops: L('sum product integral'),
  calculus: L('diff partial nabla gradient infinity oo laplace'),
  relations: L('eq equiv approx asymp prop prec succ lt gt tilde divides parallel perp frown smile smt miny tiny ratio colon models forces image original'),
  settheory: L('in subset supset union sect inter complement emptyset nothing without'),
  logic: L('forall exists and or not xor therefore because tack top bot qed'),
  arrows: L('arrow arrows arrowhead harpoon harpoons mapsto multimap angzarr'),
  delimiters: L('paren bracket brace bar fence floor ceil mustache bag'),
  accents: L('acute grave hat breve caron macron diaer dotless'),
  geometry: L('angle triangle square rect circle ellipse diamond lozenge parallelogram penta hexa corner shell hourglass diameter ballot checkmark crossmark errorbar chevron'),
  punct: L('dash hyph dots comma semi excl quest at hash slash backslash percent permille permyriad numero pilcrow section prime quote caret co interrobang dagger'),
  music: L('flat natural sharp note rest'),
  currency: L('afghani baht bitcoin cedi cent currency dollar dong dram euro franc guarani hryvnia kip lari lat lira manat naira pataca peso pound riel ruble rupee shekel som taka taman tenge togrog won yen yuan dorome cc'),
  astro: L('mars venus mercury jupiter saturn neptune uranus earth sun gender'),
  control: L('space wj zwj zwnj zws lrm rlm'),
};
const CAT_OF = {};
for (const [cat, names] of Object.entries(CAT_LISTS)) for (const n of names) CAT_OF[n] = cat;

const CAT_ORDER = [
  ['greek-lower', 'Chữ Hy Lạp thường'],
  ['greek-upper', 'Chữ Hy Lạp hoa'],
  ['hebrew', 'Chữ Do Thái (Hebrew)'],
  ['blackboard', 'Chữ bảng đen & ký hiệu chữ (ℝ, ℓ, ℏ…)'],
  ['operators', 'Toán tử'],
  ['bigops', 'Toán tử lớn (∑ ∏ ∫)'],
  ['calculus', 'Giải tích & vô cực'],
  ['relations', 'Quan hệ'],
  ['settheory', 'Lý thuyết tập hợp'],
  ['logic', 'Logic & lượng từ'],
  ['arrows', 'Mũi tên & móc'],
  ['delimiters', 'Dấu ngoặc & phân cách'],
  ['accents', 'Dấu phụ (accent)'],
  ['geometry', 'Hình học & hình khối'],
  ['punct', 'Dấu câu & ký hiệu văn bản'],
  ['music', 'Âm nhạc'],
  ['currency', 'Tiền tệ'],
  ['astro', 'Thiên văn & giới tính'],
  ['control', 'Khoảng trắng & điều khiển'],
  ['misc', 'Khác'],
];

// ---- 4. Gom mục theo category ----
const byCat = new Map(CAT_ORDER.map(([c]) => [c, []]));
let total = 0;
const miscBases = [];
for (const { name, rep } of rows) {
  const cat = CAT_OF[name] ?? 'misc';
  if (cat === 'misc') miscBases.push(name);
  const variants = parseVariants(rep);
  const items = [];
  let hasBare = false;
  for (const v of variants) {
    if (v.mod === '') { hasBare = true; items.push({ name, glyph: v.glyph }); }
    else items.push({ name: `${name}.${v.mod}`, glyph: v.glyph });
  }
  if (!hasBare && variants.length > 0) items.unshift({ name, glyph: variants[0].glyph });
  byCat.get(cat).push(...items);
  total += items.length;
}

// ---- 5. Emit symbols.ts ----
const esc = (s) => JSON.stringify(s);
let body = '';
for (const [cat, title] of CAT_ORDER) {
  const items = byCat.get(cat);
  if (!items.length) continue;
  body += `  {\n    title: ${esc(title)},\n    items: [\n`;
  for (const it of items) body += `      { name: ${esc(it.name)}, glyph: ${esc(it.glyph)} },\n`;
  body += `    ],\n  },\n`;
}

const out = `/**
 * Bộ ký hiệu Typst ĐẦY ĐỦ cho gallery — TỰ SINH, đừng sửa tay.
 * Nguồn: trình biên dịch @myriaddreamin/typst-ts-node-compiler (Typst v0.14.2),
 * lấy toàn bộ mô-đun \`sym\` + mọi biến thể qua repr(). Sinh lại:
 *   cd backend && node scripts/gen-symbols.mjs
 * Tổng: ${total} ký hiệu / ${rows.length} tên gốc.
 */
export interface SymbolItem {
  /** Tên gõ trong math mode, vd "arrow.r", "lt.eq". */
  name: string;
  glyph: string;
}

export interface SymbolGroup {
  title: string;
  items: SymbolItem[];
}

export const SYMBOL_GROUPS: SymbolGroup[] = [
${body}];

export const SYMBOL_COUNT = SYMBOL_GROUPS.reduce((n, g) => n + g.items.length, 0);
export const SYMBOL_BASE_COUNT = ${rows.length};
`;

writeFileSync(outFile, out, 'utf-8');

// File meta nhỏ (chỉ số đếm) để các trang khác hiển thị "đầy đủ N ký hiệu" mà
// KHÔNG phải import cả mảng lớn (giữ code-split).
const metaFile = resolve(here, '../../Frontendtluscholareditor/src/app/features/help/reference/symbolMeta.ts');
writeFileSync(
  metaFile,
  `/** TỰ SINH bởi backend/scripts/gen-symbols.mjs — đừng sửa tay. */\n` +
    `export const SYMBOL_TOTAL = ${total};\n` +
    `export const SYMBOL_BASE_TOTAL = ${rows.length};\n`,
  'utf-8',
);
console.log(`Đã sinh ${outFile}`);
console.log(`Đã sinh ${metaFile}`);
console.log(`Tổng ${total} ký hiệu / ${rows.length} tên gốc.`);
console.log(`Nhóm "Khác" (${miscBases.length} tên gốc): ${miscBases.join(' ')}`);
