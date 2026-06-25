/**
 * Sinh ảnh snapshot (SVG) cho BỘ TRA CỨU Typst (spec typst-reference-complete)
 * bằng cách biên dịch thật các đoạn Typst qua @myriaddreamin/typst-ts-node-compiler.
 *
 * Chạy:  cd backend && node scripts/gen-reference-snapshots.mjs
 * Đầu ra: Frontendtluscholareditor/public/help-previews/ref/<id>.svg
 * Id khớp `snapshotId` trong src/app/features/help/reference/*.ts (vd visualize-circle).
 *
 * Font: backend/var/fonts (Times New Roman = tiếng Việt, NewCMMath = toán).
 */
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fontDir = resolve(here, '../var/fonts');
const outDir = resolve(here, '../../Frontendtluscholareditor/public/help-previews/ref');
mkdirSync(outDir, { recursive: true });

const pre = (width) => `#set page(width: ${width}, height: auto, margin: 8pt, fill: white)
#set text(font: "Times New Roman", size: 12pt, lang: "vi", region: "VN")
`;

// id = <category>-<fn>, khớp snapshotId trong dữ liệu reference.
const SNIPPETS = [
  // ----- visualize -----
  { id: 'visualize-circle', w: 'auto', body: `#circle(radius: 24pt, fill: blue.lighten(70%), stroke: blue)` },
  { id: 'visualize-rect', w: 'auto', body: `#rect(width: 4cm, height: 1.6cm, radius: 4pt, fill: blue.lighten(85%), stroke: blue)[Hộp]` },
  { id: 'visualize-square', w: 'auto', body: `#square(size: 2cm, fill: green.lighten(80%), stroke: green)` },
  { id: 'visualize-ellipse', w: 'auto', body: `#ellipse(width: 4cm, height: 2cm, fill: orange.lighten(80%), stroke: orange)` },
  {
    id: 'visualize-line',
    w: 'auto',
    body: `#stack(dir: ttb, spacing: 10pt,
  line(length: 4cm),
  line(length: 4cm, stroke: 2pt + maroon),
  line(length: 4cm, stroke: (paint: blue, dash: "dashed")),
)`,
  },
  { id: 'visualize-polygon', w: 'auto', body: `#polygon.regular(fill: blue.lighten(80%), stroke: blue, size: 40pt, vertices: 5)` },
  {
    id: 'visualize-curve',
    w: 'auto',
    body: `#curve(
  fill: blue.lighten(80%), stroke: blue,
  curve.move((0pt, 50pt)),
  curve.line((100pt, 50pt)),
  curve.cubic(none, (90pt, 0pt), (50pt, 0pt)),
  curve.close(),
)`,
  },
  { id: 'visualize-gradient', w: 'auto', body: `#rect(width: 5cm, height: 1.4cm, fill: gradient.linear(blue, purple, red))` },
  {
    id: 'visualize-stroke',
    w: 'auto',
    body: `#stack(dir: ttb, spacing: 10pt,
  line(length: 4cm, stroke: (paint: black, thickness: 2pt, cap: "round")),
  line(length: 4cm, stroke: (paint: blue, dash: "dashed")),
  line(length: 4cm, stroke: (paint: red, dash: "dotted")),
)`,
  },
  {
    id: 'visualize-color',
    w: 'auto',
    body: `#stack(dir: ltr, spacing: 8pt,
  square(size: 24pt, fill: rgb("#007bff")),
  square(size: 24pt, fill: oklch(70%, 0.15, 30deg)),
  square(size: 24pt, fill: luma(60%)),
  square(size: 24pt, fill: red.lighten(40%)),
)`,
  },

  // ----- text -----
  { id: 'text-text', w: '360pt', body: `#text(weight: "bold")[Đậm], #text(fill: blue)[xanh], #text(tracking: 1.5pt)[giãn], #text(style: "italic")[nghiêng].` },
  { id: 'text-sub', w: 'auto', body: `H#sub[2]O và a#sub[i]` },
  { id: 'text-super', w: 'auto', body: `x#super[2] + y#super[n]` },
  { id: 'text-underline', w: 'auto', body: `#underline[Văn bản gạch chân]` },
  { id: 'text-overline', w: 'auto', body: `#overline[Văn bản kẻ trên]` },
  { id: 'text-strike', w: 'auto', body: `#strike[Văn bản bị gạch]` },
  { id: 'text-highlight', w: 'auto', body: `#highlight[Đoạn được tô nền]` },
  { id: 'text-smallcaps', w: 'auto', body: `#smallcaps[Tiêu đề chữ hoa nhỏ]` },
  { id: 'text-raw', w: 'auto', body: `#raw("def f(x): return x * 2", lang: "python", block: true)` },

  // ----- model -----
  { id: 'model-heading', w: '360pt', body: `#set heading(numbering: "1.1")
= Chương một
== Mục con` },
  { id: 'model-list', w: '320pt', body: `- Mục thứ nhất
- Mục thứ hai
  - Mục con` },
  { id: 'model-enum', w: '320pt', body: `+ Bước một
+ Bước hai
+ Bước ba` },
  { id: 'model-terms', w: '360pt', body: `/ Typst: ngôn ngữ soạn thảo
/ PDF: định dạng xuất bản` },
  {
    id: 'model-table',
    w: 'auto',
    body: `#table(
  columns: 3,
  table.header[STT][Họ và tên][Điểm],
  [1], [Nguyễn Văn A], [9.0],
  [2], [Trần Thị B], [8.5],
)`,
  },
  {
    id: 'model-figure',
    w: '360pt',
    body: `#figure(
  rect(width: 50%, height: 1.6cm, fill: luma(235), stroke: 0.5pt + luma(160)),
  caption: [Sơ đồ kiến trúc], kind: image, supplement: [Hình],
)`,
  },
  {
    id: 'model-outline',
    w: '360pt',
    body: `#outline(title: "Mục lục")
= Mở đầu
== Bối cảnh
= Kết luận`,
  },
  { id: 'model-par', w: '360pt', body: `#set par(justify: true, first-line-indent: 1.25em)
#lorem(28)` },
  {
    id: 'model-quote',
    w: '360pt',
    body: `#quote(block: true, attribution: [Einstein])[
  Trí tưởng tượng quan trọng hơn kiến thức.
]`,
  },

  // ----- layout -----
  { id: 'layout-align', w: '320pt', body: `#align(center)[Văn bản căn giữa]` },
  {
    id: 'layout-grid',
    w: '320pt',
    body: `#grid(
  columns: (1fr, 1fr), gutter: 8pt,
  rect(fill: blue.lighten(85%), inset: 8pt, width: 100%)[Cột trái],
  rect(fill: green.lighten(85%), inset: 8pt, width: 100%)[Cột phải],
)`,
  },
  { id: 'layout-columns', w: '360pt', body: `#columns(2)[#lorem(28)]` },
  {
    id: 'layout-stack',
    w: 'auto',
    body: `#stack(dir: ttb, spacing: 6pt,
  rect(width: 3cm, fill: luma(230), inset: 5pt)[A],
  rect(width: 3cm, fill: luma(230), inset: 5pt)[B],
)`,
  },
  {
    id: 'layout-place',
    w: 'auto',
    body: `#block(width: 5cm, height: 2.4cm, stroke: 0.5pt + luma(180), inset: 6pt)[
  #place(top + right, dx: -2pt)[#text(fill: red)[góc]]
  Nội dung chính
]`,
  },
  { id: 'layout-block', w: '320pt', body: `#block(fill: blue.lighten(85%), inset: 8pt, radius: 4pt, stroke: blue)[Khối có nền và viền]` },
  { id: 'layout-box', w: '320pt', body: `Chữ #box(fill: yellow, inset: (x: 3pt))[nổi bật] giữa dòng văn bản.` },
  { id: 'layout-pad', w: 'auto', body: `#rect(stroke: 0.5pt + luma(160))[#pad(10pt)[Nội dung có đệm]]` },
  { id: 'layout-rotate', w: 'auto', body: `#rotate(30deg, reflow: true)[Nghiêng 30°]` },
  { id: 'layout-scale', w: 'auto', body: `#scale(150%, reflow: true)[To gấp rưỡi]` },
  { id: 'layout-repeat', w: '320pt', body: `Mục 1 #box(width: 1fr, repeat[.]) 5` },

  // ----- math -----
  { id: 'math-equation', w: 'auto', body: `$ a^2 + b^2 = c^2 $` },
  { id: 'math-frac', w: 'auto', body: `$ frac(a + b, c) $` },
  { id: 'math-mat', w: 'auto', body: `$ A = mat(1, 2; 3, 4) $` },
  { id: 'math-vec', w: 'auto', body: `$ vec(1, 2, 3) $` },
  { id: 'math-cases', w: 'auto', body: `$ f(x) = cases(x "nếu" x >= 0, -x "ngược lại") $` },
  { id: 'math-accent', w: 'auto', body: `$ hat(x) quad tilde(y) quad arrow(v) quad dot(z) $` },
  { id: 'math-attach', w: 'auto', body: `$ sum_(i=1)^n x_i^2 $` },
  { id: 'math-root', w: 'auto', body: `$ sqrt(x + 1) quad root(3, x) $` },
  { id: 'math-binom', w: 'auto', body: `$ binom(n, k) $` },
  { id: 'math-op', w: 'auto', body: `$ lim_(x -> 0) (sin x) / x = 1 $` },
  { id: 'math-lr', w: 'auto', body: `$ abs((a) / (b)) quad norm(v) $` },
  { id: 'math-cancel', w: 'auto', body: `$ (cancel(x) dot y) / cancel(x) = y $` },
  { id: 'math-underover', w: 'auto', body: `$ underbrace(1 + 2 + 3, "ba số") $` },
  { id: 'math-variants', w: 'auto', body: `$ cal(F) quad frak(g) quad bb(R) quad sans(x) $` },

  // ----- foundations (hiển thị KẾT QUẢ của ví dụ, như typst.app) -----
  { id: 'foundations-calc', w: 'auto', body: `pow(2, 10) = #calc.pow(2, 10) #h(1em) round(3.14159, 2) = #calc.round(3.14159, digits: 2) #h(1em) sqrt(144) = #calc.sqrt(144)` },
  { id: 'foundations-str', w: 'auto', body: `"abc".rev() = #"abc".rev() #h(1em) "a,b,c".split(",").len() = #"a,b,c".split(",").len()` },
  { id: 'foundations-array', w: 'auto', body: `(3, 1, 2).sorted() = #(3, 1, 2).sorted() #h(1em) bình phương (1, 2, 3) = #(1, 2, 3).map(x => x * x)` },
  { id: 'foundations-dictionary', w: 'auto', body: `(ten: "An", tuoi: 20).at("ten") = #(ten: "An", tuoi: 20).at("ten")` },
  { id: 'foundations-int', w: 'auto', body: `int("42") + 0xff = #(int("42") + 0xff)` },
  { id: 'foundations-float', w: 'auto', body: `float("3.14") · 2 = #(float("3.14") * 2)` },
  { id: 'foundations-decimal', w: 'auto', body: `decimal("0.1") + decimal("0.2") = #(decimal("0.1") + decimal("0.2"))` },
  { id: 'foundations-datetime', w: 'auto', body: `Ngày: #datetime(year: 2026, month: 6, day: 22).display("[day]/[month]/[year]")` },
  { id: 'foundations-duration', w: 'auto', body: `duration(days: 3).hours() = #duration(days: 3).hours()` },
  { id: 'foundations-content', w: 'auto', body: `#let x = [*Đậm*]
Hàm phần tử của [*Đậm*] là: #x.func()` },
  { id: 'foundations-arguments', w: 'auto', body: `#let format(title, ..authors) = {
  let by = authors.pos().join(", ", last: " và ")
  [*#title* — viết bởi #by]
}
#format("ArtosFlow", "Jane", "Joe")` },
  { id: 'foundations-function', w: 'auto', body: `#let add2 = x => x + 2
add2(5) = #add2(5) #h(1em) #let nhan = (a, b) => a * b
nhan(6, 7) = #nhan(6, 7)` },
  { id: 'foundations-regex', w: 'auto', body: String.raw`Số đầu tiên trong "abc123def": #"abc123def".find(regex("\d+"))` },
  { id: 'foundations-symbol', w: 'auto', body: `#sym.arrow.r #h(.6em) #sym.alpha #h(.6em) #sym.RR #h(.6em) #sym.subset.eq #h(.6em) #sym.infinity` },
  { id: 'foundations-label', w: '320pt', body: `#set heading(numbering: "1.")
= Mở đầu <intro>
Tham chiếu tới mục @intro.` },
  { id: 'foundations-selector', w: '320pt', body: `#show heading.where(level: 1): set text(fill: blue)
= Tiêu đề cấp 1 (xanh)
== Tiêu đề cấp 2 (thường)` },
  { id: 'foundations-bytes', w: 'auto', body: `bytes((104, 105)).len() = #bytes((104, 105)).len()` },
  { id: 'foundations-version', w: 'auto', body: `version(0, 14, 2).at(1) = #version(0, 14, 2).at(1)` },
  { id: 'foundations-type', w: 'auto', body: `type(10) = #type(10) #h(1em) type("hi") = #type("hi") #h(1em) type(1.5) = #type(1.5) #h(1em) type(true) = #type(true)` },
  { id: 'foundations-repr', w: 'auto', body: `repr((1, 2)) = #repr((1, 2)) #h(1em) repr("x") = #repr("x")` },
  { id: 'foundations-eval', w: 'auto', body: `eval("1 + 2") = #eval("1 + 2") #h(1em) eval("2 · 3") = #eval("2 * 3")` },

  // ----- model (cú pháp còn thiếu ảnh) -----
  { id: 'model-strong', w: 'auto', body: `Đây là *văn bản in đậm* trong câu.` },
  { id: 'model-emph', w: 'auto', body: `Đây là _văn bản in nghiêng_ trong câu.` },
  { id: 'model-link', w: 'auto', body: `Xem #link("https://typst.app")[Trang chủ Typst].` },
  { id: 'model-ref', w: '320pt', body: `#set heading(numbering: "1.")
= Giới thiệu <intro>
Xem @intro để biết thêm.` },
  { id: 'model-footnote', w: '320pt', body: `Một khẳng định#footnote[Nguồn tham khảo.] trong văn bản.` },
  { id: 'model-numbering', w: 'auto', body: `#numbering("1.1", 1, 2) #h(1em) #numbering("I.a", 1, 2) #h(1em) #numbering("a)", 3)` },

  // ----- text (cú pháp còn thiếu ảnh) -----
  { id: 'text-upper', w: 'auto', body: `#upper("đại học thuỷ lợi")` },
  { id: 'text-lower', w: 'auto', body: `#lower("ĐẠI HỌC THUỶ LỢI")` },
  { id: 'text-lorem', w: '320pt', body: `#lorem(20)` },
  { id: 'text-linebreak', w: 'auto', body: `Dòng thứ nhất #linebreak() Dòng thứ hai` },

  // ----- layout (cú pháp còn thiếu ảnh) -----
  { id: 'layout-h', w: '300pt', body: `Trái #h(1fr) Giữa #h(1fr) Phải` },
  { id: 'layout-v', w: 'auto', body: `Khối trên #v(1cm) Khối dưới` },
  { id: 'layout-move', w: 'auto', body: `Gốc #move(dx: 14pt, dy: -6pt)[đã dịch] tham chiếu.` },
  { id: 'layout-skew', w: 'auto', body: `#skew(ax: 20deg)[Văn bản nghiêng xiên]` },
  { id: 'layout-hide', w: 'auto', body: `Trước #hide[ẩn] sau (chừa chỗ).` },
  { id: 'layout-alignment', w: '280pt', body: `#rect(width: 100%, height: 1.6cm, stroke: 0.5pt)[#align(right + horizon)[Phải + giữa]]` },
  { id: 'layout-angle', w: 'auto', body: `#rotate(30deg)[30°] #h(1.5em) #rotate(-20deg)[−20°]` },
  { id: 'layout-direction', w: 'auto', body: `#stack(dir: ltr, spacing: 8pt, rect(inset: 4pt)[A], rect(inset: 4pt)[B], rect(inset: 4pt)[C])` },
  { id: 'layout-ratio', w: '280pt', body: `#block(width: 60%, fill: luma(230), inset: 4pt)[Chiều rộng 60%]` },
  { id: 'layout-fraction', w: '280pt', body: `#grid(columns: (1fr, 2fr), stroke: 0.5pt, inset: 5pt)[1fr][2fr (gấp đôi)]` },

  // ----- math (cú pháp còn thiếu ảnh) -----
  { id: 'math-primes', w: 'auto', body: `$ f'(x) quad f''(x) quad f'''(x) $` },
  { id: 'math-stretch', w: 'auto', body: `$ A stretch(->, size: #3em) B $` },
  { id: 'math-sizes', w: 'auto', body: `$ display(sum_(i=1)^n) quad inline(sum_(i=1)^n) $` },
  { id: 'math-sym', w: 'auto', body: `$ alpha + beta = gamma quad pi r^2 quad x in RR $` },

  // ----- visualize -----
  { id: 'visualize-tiling', w: 'auto', body: `#let pat = tiling(size: (10pt, 10pt))[#place(circle(radius: 2.5pt, fill: blue))]
#rect(width: 4cm, height: 1.5cm, fill: pat, stroke: 0.5pt)` },

  // ----- introspection -----
  { id: 'introspection-counter', w: '300pt', body: `#let c = counter("buoc")
#c.step()#c.step()#c.step()
Số bước hiện tại: #context c.display()` },
  { id: 'introspection-state', w: '300pt', body: `#let s = state("diem", 8.5)
Điểm hiện tại: #context s.get()` },
  { id: 'introspection-here', w: '300pt', body: `#context [Đang ở trang #here().page().]` },
  { id: 'introspection-query', w: '300pt', body: `#set heading(numbering: "1.")
= Mục A
= Mục B
#context [Số tiêu đề: #query(heading).len()]` },

  // ----- data-loading (decode inline, không cần file) -----
  { id: 'data-loading-json', w: '320pt', body: String.raw`#let d = json.decode(bytes("{\"ten\": \"An\", \"diem\": 9}"))
Tên: #d.ten, điểm: #d.diem` },
  { id: 'data-loading-csv', w: '320pt', body: String.raw`#let rows = csv.decode(bytes("ten,diem\nAn,9\nBình,8"))
Số dòng: #rows.len()` },
  { id: 'data-loading-yaml', w: '320pt', body: String.raw`#let d = yaml.decode(bytes("ten: An\ndiem: 9"))
#d.ten — #d.diem` },
  { id: 'data-loading-toml', w: '320pt', body: String.raw`#let d = toml.decode(bytes("ten = \"An\"\ndiem = 9"))
#d.ten — #d.diem` },
  { id: 'data-loading-xml', w: '320pt', body: String.raw`#let d = xml.decode(bytes("<r><a>An</a></r>"))
Thẻ gốc: #d.first().tag` },
];

const compiler = NodeCompiler.create({
  workspace: outDir,
  fontArgs: [{ fontPaths: [fontDir] }],
});

// Gộp snippet cơ bản (SNIPPETS, viết tay) + manifest sinh tự động từ registry
// (paramExamples). Manifest ghi đè khi trùng id.
const manifestPath = resolve(here, 'reference-snapshots.manifest.json');
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf-8'))
  : [];
const byId = new Map();
for (const s of SNIPPETS) byId.set(s.id, { id: s.id, w: s.w, body: s.body });
for (const m of manifest) byId.set(m.id, { id: m.id, w: m.width ?? 'auto', body: m.code });
const all = [...byId.values()];
console.log(`Nguồn: ${SNIPPETS.length} snippet cơ bản + ${manifest.length} từ manifest = ${all.length} id.`);

const only = process.argv[2];
const list = only ? all.filter((s) => s.id.includes(only)) : all;

let ok = 0;
let fail = 0;
for (const { id, w, body } of list) {
  const res = compiler.compile({ mainFileContent: pre(w) + body });
  if (res.hasError()) {
    const err = res.takeError();
    console.error(`[FAIL] ${id}:`, JSON.stringify(err?.shortDiagnostics ?? err));
    fail++;
    continue;
  }
  const doc = res.result;
  if (!doc) {
    console.error(`[FAIL] ${id}: no document`);
    fail++;
    continue;
  }
  writeFileSync(resolve(outDir, `${id}.svg`), compiler.svg(doc), 'utf-8');
  console.log(`[OK]   ref/${id}.svg`);
  ok++;
}

console.log(`\nHoàn tất: ${ok} thành công, ${fail} lỗi → ${outDir}`);

// Báo cáo ảnh orphan (chỉ khi chạy đầy đủ, không lọc): .svg có trong ref/ nhưng
// không còn id nào trong nguồn → nên xoá để "không thiếu/không thừa".
if (!only) {
  const wanted = new Set(all.map((s) => s.id));
  const orphans = readdirSync(outDir)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.replace(/\.svg$/, ''))
    .filter((id) => !wanted.has(id));
  if (orphans.length) {
    console.warn(`\n[ORPHAN] ${orphans.length} ảnh không còn trong nguồn (cân nhắc xoá):`);
    for (const o of orphans) console.warn(`  - ref/${o}.svg`);
  } else {
    console.log('Không có ảnh orphan.');
  }
}
