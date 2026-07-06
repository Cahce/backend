// template.typ — Cấu trúc trang, phông chữ, kiểu đề mục, đánh số hình/bảng.
// Bám "Hướng dẫn trình bày ĐATN (26-2-2020)" đúng như bản Word gốc:
//   • Khổ A4, lề trái 3 cm, phải 2 cm, trên/dưới 2,5 cm.
//   • Times New Roman 13 pt, giãn dòng 1,5; căn đều.
//   • CHƯƠNG 1 (14pt đậm HOA) · 1.1 (13pt đậm) · 1.1.1 (13pt đậm nghiêng)
//     · 1.1.1.1 (13pt nghiêng).
//   • Hình đánh số theo chương "Hình 2.1" (chú thích DƯỚI); bảng "Bảng 3.1"
//     (chú thích TRÊN); tự gom vào Danh mục hình / Danh mục bảng.

#import "colors.typ": ink

// Tiêu đề trang phần mở đầu (LỜI CAM ĐOAN, MỤC LỤC…) — không phải heading nên
// không lọt vào Mục lục, không tăng bộ đếm chương.
#let frontmatter-title(body) = {
  pagebreak(weak: true)
  align(center)[
    #set text(size: 14pt, weight: "bold")
    #upper(body)
  ]
  v(14pt)
}

#let thesis(body) = {
  set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, left: 3cm, right: 2cm))
  set text(font: "Times New Roman", size: 13pt, lang: "vi", region: "VN", fill: ink)
  set par(justify: true, leading: 1em, spacing: 1em, first-line-indent: 0pt)
  set list(indent: 8pt, marker: ([–], [•], [‣]))
  set enum(indent: 8pt)

  // Đánh số đề mục: CHƯƠNG 1. / 1.1 / 1.1.1
  set heading(numbering: (..n) => {
    let nums = n.pos()
    if nums.len() == 1 { [CHƯƠNG #numbering("1", nums.at(0)).] } else { numbering("1.1.1.1", ..nums) }
  })

  show heading.where(level: 1): it => {
    pagebreak(weak: true)
    counter(figure.where(kind: image)).update(0)
    counter(figure.where(kind: table)).update(0)
    block(below: 18pt, above: 0pt)[
      #set text(size: 14pt, weight: "bold")
      #upper(it)
    ]
  }
  show heading.where(level: 2): it => block(above: 14pt, below: 8pt)[
    #set text(size: 13pt, weight: "bold"); #it
  ]
  show heading.where(level: 3): it => block(above: 12pt, below: 6pt)[
    #set text(size: 13pt, weight: "bold", style: "italic"); #it
  ]
  show heading.where(level: 4): it => block(above: 10pt, below: 6pt)[
    #set text(size: 13pt, style: "italic"); #it
  ]

  // Hình & bảng đánh số theo chương.
  set figure(numbering: n => {
    let ch = counter(heading).get().first()
    numbering("1.1", ch, n)
  })
  show figure.where(kind: image): set figure(supplement: [Hình])
  show figure.where(kind: table): set figure(supplement: [Bảng])
  show figure.caption: set text(size: 12pt, style: "italic")
  set figure.caption(separator: [ ])
  show figure.where(kind: table): set figure.caption(position: top)

  // Bảng: viền đơn, chữ 12pt; hàng tiêu đề căn giữa, ô nội dung căn TRÁI;
  // không dàn đều hai biên trong ô; bảng dài tự ngắt trang (không tràn footer).
  show figure.where(kind: table): set text(size: 12pt)
  set table(
    stroke: 0.5pt + ink,
    inset: (x: 6pt, y: 4pt),
    align: (_, y) => (if y == 0 { center } else { left }) + horizon,
  )
  show table.cell: set par(justify: false)
  show figure.where(kind: table): set block(breakable: true)

  body
}
