/**
 * Sinh ảnh preview (SVG) cho Trung tâm trợ giúp của frontend bằng cách biên dịch
 * thật các đoạn Typst qua @myriaddreamin/typst-ts-node-compiler.
 *
 * Chạy:  cd backend && node scripts/gen-help-previews.mjs
 * Đầu ra: Frontendtluscholareditor/public/help-previews/<id>.svg
 *
 * Font lấy từ backend/var/fonts (Times New Roman hỗ trợ tiếng Việt, New CM Math
 * cho công thức). Glyph được nhúng vào SVG nên hiển thị đúng ở mọi trình duyệt.
 */
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fontDir = resolve(here, '../var/fonts');
const outDir = resolve(here, '../../Frontendtluscholareditor/public/help-previews');
mkdirSync(outDir, { recursive: true });

/** Preamble: trang tự co theo nội dung, nền trắng, font Việt, ngôn ngữ vi. */
const pre = (width) => String.raw`#set page(width: ${width}, height: auto, margin: 12pt, fill: white)
#set text(font: "Times New Roman", size: 13pt, lang: "vi", region: "VN")
#set par(justify: true, leading: 0.78em)
`;

const SNIPPETS = [
  {
    id: 'markup',
    w: '380pt',
    body: String.raw`= Chương 1: Giới thiệu
Đoạn văn có chữ *in đậm* và _in nghiêng_.

- Mục thứ nhất
- Mục thứ hai

+ Bước một
+ Bước hai`,
  },
  {
    id: 'vietnamese',
    w: '380pt',
    body: String.raw`= Lời mở đầu
Đây là đoạn văn tiếng Việt đầy đủ dấu: ăn, ấm, ờ, ữ, ặ, ỹ.
Phương pháp nghiên cứu khoa học và ứng dụng thực tiễn trong đồ án tốt nghiệp.`,
  },
  {
    id: 'math-basic',
    w: 'auto',
    body: String.raw`$ a^2 + b^2 = c^2 $

$ "diện tích" = pi r^2 $

$ sum_(i=1)^n i = (n (n + 1)) / 2 $`,
  },
  {
    id: 'math-matrix',
    w: 'auto',
    body: String.raw`$ A = mat(1, 2; 3, 4) $

$ f(x) = cases(x\, &"nếu" x >= 0, -x\, &"nếu" x < 0) $

$ sum_(k=0)^n k &= 1 + 2 + ... + n \
              &= (n (n + 1)) / 2 $`,
  },
  {
    id: 'text-format',
    w: '380pt',
    body: String.raw`#text(weight: "bold")[Đậm], #text(style: "italic")[nghiêng],
#text(size: 1.5em, fill: blue)[to và xanh],
#text(tracking: 1.5pt)[giãn ký tự].`,
  },
  {
    id: 'figure-table',
    w: '380pt',
    body: String.raw`#figure(
  rect(width: 70%, height: 2.2cm, fill: luma(235), stroke: 0.5pt + luma(160)),
  caption: [Sơ đồ kiến trúc hệ thống],
  kind: image,
  supplement: [Hình],
) <fig-kientruc>

Xem chi tiết ở @fig-kientruc.

#figure(
  table(
    columns: 3,
    table.header[STT][Họ và tên][Điểm],
    [1], [Nguyễn Văn A], [9.0],
    [2], [Trần Thị B], [8.5],
  ),
  caption: [Bảng điểm sinh viên],
)`,
  },
  {
    id: 'set-show',
    w: '380pt',
    body: String.raw`#show heading: set text(navy)
#show heading.where(level: 1): it => [Chương: #it.body]
#show regex("\d+"): set text(blue)

= Giới thiệu
Phiên bản 2024, cập nhật 12 lần.`,
  },
  {
    id: 'model',
    w: '380pt',
    body: String.raw`#heading(level: 2)[Phần mở đầu]

#figure(
  rect(width: 60%, height: 1.8cm, fill: luma(235), stroke: 0.5pt + luma(160)),
  caption: [Sơ đồ tổng quan], kind: image, supplement: [Hình],
) <so-do>

#table(
  columns: 2,
  table.header[Tiêu chí][Giá trị],
  [Khổ giấy], [A4],
  [Cỡ chữ], [13pt],
)

Xem @so-do và #link("https://typst.app")[trang chủ Typst].`,
  },
  {
    id: 'layout',
    w: '420pt',
    body: String.raw`#align(center)[#text(18pt, weight: "bold")[TIÊU ĐỀ]]

#grid(
  columns: (1fr, 1fr),
  gutter: 1em,
  [Cột trái], [Cột phải],
)

Văn bản #h(1fr) căn sang phải.`,
  },
  {
    id: 'foundations',
    w: '360pt',
    body: String.raw`Luỹ thừa #sym.arrow.r #calc.pow(2, 10) \
Làm tròn #sym.arrow.r #calc.round(3.14159, digits: 2) \
Sắp xếp #sym.arrow.r #repr((3, 1, 2).sorted()) \
Nhân đôi #sym.arrow.r #repr((3, 1, 2).map(x => x * 2)) \
Số phần tử #sym.arrow.r #("a,b,c".split(",").len())`,
  },
  {
    id: 'introspection',
    w: '340pt',
    body: String.raw`#let dem = counter("muc")
#dem.update(1)
Mục số #context dem.get().first() \
#let ten = state("ten", "TLU")
Trạng thái: #context ten.get() \
Trang hiện tại: #context here().page()`,
  },
  {
    id: 'visualize',
    w: 'auto',
    body: String.raw`#rect(width: 4cm, height: 1.6cm, radius: 4pt,
      fill: blue.lighten(85%), stroke: blue)[Hộp]
#h(10pt)
#circle(radius: 0.8cm, fill: red.lighten(70%))`,
  },
];

const compiler = NodeCompiler.create({
  workspace: outDir,
  fontArgs: [{ fontPaths: [fontDir] }],
});

let ok = 0;
let fail = 0;
for (const { id, w, body } of SNIPPETS) {
  const source = pre(w) + body;
  const res = compiler.compile({ mainFileContent: source });
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
  // NOTE: dùng svg() (rich) thay plainSvg() — bản node-compiler hiện tại panic
  // ("unreachable" tại node.rs:322) khi gọi plainSvg(); svg() cho SVG standalone
  // hợp lệ, hiển thị được qua <img>.
  const svg = compiler.svg(doc);
  writeFileSync(resolve(outDir, `${id}.svg`), svg, 'utf-8');
  console.log(`[OK]   ${id}.svg (${(svg.length / 1024).toFixed(1)} KB)`);
  ok++;
}

console.log(`\nHoàn tất: ${ok} thành công, ${fail} lỗi → ${outDir}`);
