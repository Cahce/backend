#import "colors.typ": *

#let dotline = text(size: 10pt, fill: doc-blue)[. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .]

#let mission-header(logo-path: "../assets/images/image-001.png") = table(
  columns: (4.8cm, 10.8cm),
  stroke: 0.6pt + doc-black,
  inset: 0pt,
  table.cell(fill: header-gray, align: center, inset: 3pt)[
    #image(logo-path, width: 3.45cm)
  ],
  table.cell(align: center, inset: (x: 4pt, y: 3pt))[
    #text(size: 13pt, fill: doc-blue)[CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM] \
    #underline[#strong[#text(size: 13pt, fill: doc-blue)[Độc lập - Tự do - Hạnh phúc]]] \
    #text(fill: doc-black, size: 9pt)[----------★----------] \
    #v(2pt)
    #strong[#text(size: 17pt, fill: doc-red)[NHIỆM VỤ ĐỒ ÁN TỐT NGHIỆP]]
  ],
)

#let thin-table(columns, body) = table(
  columns: columns,
  stroke: 0.45pt + doc-black,
  inset: (x: 4pt, y: 2pt),
  ..body
)

#let signature-row(left-title, right-title) = grid(
  columns: (1fr, 1fr),
  column-gutter: 1.8cm,
  align(left)[
    #strong[left-title] \
    #emph[(Ký và ghi rõ Họ tên)]
  ],
  align(center)[
    #strong[right-title] \
    #emph[(Ký và ghi rõ Họ tên)]
  ],
)
