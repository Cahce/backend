// utils.typ — Hàm tiện ích dùng trong toàn quyển đồ án.

#import "colors.typ": *

// --- Hình có chú thích (Hình x.y, chú thích DƯỚI hình, tự đánh số theo chương) --
#let fig(path, caption, width: 85%) = figure(
  image(path, width: width),
  caption: caption,
  kind: image,
)

// --- Khung giữ chỗ khi chưa có hình (thay bằng fig(...) khi đã chèn ảnh) --------
#let fig-placeholder(note, caption) = figure(
  rect(
    width: 85%,
    inset: 16pt,
    stroke: (paint: hairline, thickness: 0.75pt, dash: "dashed"),
    fill: none,
  )[
    #set text(fill: muted, style: "italic", size: 11pt)
    #align(center)[\[Chèn hình: #note\]]
  ],
  caption: caption,
  kind: image,
)

// --- Bảng có chú thích (Bảng x.y, chú thích TRÊN bảng) --------------------------
#let tbl(caption, body) = figure(body, caption: caption, kind: table)

// --- Danh mục từ viết tắt --------------------------------------------------------
#let acronym-table(entries) = table(
  columns: (3.9cm, 12cm),
  inset: (x: 7pt, y: 5pt),
  align: (left + horizon, left + horizon),
  stroke: 0.5pt + ink,
  table.header([*Từ viết tắt*], [*Tên đầy đủ / Giải thích*]),
  ..entries.map(((k, v)) => (strong(k), v)).flatten()
)

// --- Đề mục KHÔNG đánh số (mục con của MỞ ĐẦU / KẾT LUẬN) ------------------------
// LƯU Ý: truyền CHUỖI trong ngoặc kép — ví dụ #muc("1. Kết quả đạt được") —
// để "1. " không bị Typst hiểu nhầm là danh sách đánh số.
#let muc(title) = heading(level: 2, numbering: none, text(title))

// --- Đầu biểu mẫu TỜ NHIỆM VỤ (ô logo + quốc hiệu + tiêu đề đỏ) -----------------
#let mission-header(logo-path: "../assets/images/logo-tlu.png") = table(
  columns: (4.8cm, 11.1cm),
  stroke: 0.6pt + ink,
  inset: 0pt,
  table.cell(fill: header-gray, align: center + horizon, inset: 3pt)[
    #image(logo-path, width: 3.2cm)
  ],
  table.cell(align: center, inset: (x: 4pt, y: 3pt))[
    #set par(justify: false, leading: 0.5em, spacing: 0.5em)
    #text(size: 13pt, fill: doc-blue)[CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM] \
    #underline[#strong[#text(size: 13pt, fill: doc-blue)[Độc lập - Tự do - Hạnh phúc]]] \
    #text(fill: ink, size: 10pt)[----------★----------]
    #v(2pt)
    #strong[#text(size: 17pt, fill: doc-red)[NHIỆM VỤ ĐỒ ÁN TỐT NGHIỆP]]
  ],
)
