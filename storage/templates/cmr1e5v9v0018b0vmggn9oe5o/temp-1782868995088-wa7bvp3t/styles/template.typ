#import "colors.typ": *

#let project(title: "", body) = {
  set document(title: title)
  set page(
    width: 21.59cm,
    height: 27.94cm,
    margin: (top: 0.75cm, bottom: 0.4cm, left: 2.8cm, right: 1.5cm),
    header: align(left)[#text(fill: doc-black, size: 11pt)[Mẫu 2]],
    footer: none,
  )
  set text(font: "Times New Roman", size: 11pt, lang: "vi", fill: doc-blue)
  // Biểu mẫu điền tay: giãn dòng rộng hơn để các dòng chấm trải đều gần kín
  // trang như bản Word (đủ chỗ ghi tay), thay vì dồn lên trên.
  set par(justify: false, leading: 0.7em, spacing: 0.4cm)
  body
}
