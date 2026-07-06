// utils.typ — Hàm tiện ích dùng trong toàn báo cáo.

#import "colors.typ": *

// --- Hình có chú thích (Hình x.y, chú thích DƯỚI hình) -------------------------
#let fig(path, caption, width: 85%) = figure(
  image(path, width: width),
  caption: caption,
  kind: image,
)

// --- Khung giữ chỗ khi chưa có hình --------------------------------------------
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

// --- Đề mục KHÔNG đánh số của phần Mở đầu / Kết luận ----------------------------
// Dùng cho các mục "1. Lý do chọn đề tài", "2. Mục đích nghiên cứu"… — hiển thị
// số thứ tự tự gõ, vẫn vào Mục lục nhưng không dùng bộ đếm chương.
// Nhận CHUỖI (trong ngoặc kép) để "1. " không bị hiểu nhầm là danh sách đánh số.
#let muc(title) = heading(level: 2, numbering: none, text(title))
