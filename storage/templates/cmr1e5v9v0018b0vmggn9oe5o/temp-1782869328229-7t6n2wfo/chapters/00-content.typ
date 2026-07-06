#import "../styles/colors.typ": *
#import "../styles/utils.typ": *

#mission-header()

#v(22pt)

#grid(
  columns: (2.7cm, 6.7cm, 2.4cm, 3.2cm),
  [Họ tên sinh viên:],
  [#text(size: 10pt)[. . . . . . . . . . . . . . . . . . . . . . . .]],
  [Hệ đào tạo :],
  [#text(size: 10pt)[. . . . . . . . . . . . . . .]],
)

#grid(
  columns: (1.1cm, 3.2cm, 1.5cm, 9.2cm),
  [Lớp:],
  [#text(size: 10pt)[. . . . . . . . . . . . . .]],
  [Ngành:],
  [#text(size: 10pt)[. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .]],
)

#grid(
  columns: (1.2cm, 1fr),
  [Khoa:],
  [#dotline],
)

#v(20pt)

1- TÊN ĐỀ TÀI:

#dotline

#dotline

#v(12pt)

2- CÁC TÀI LIỆU CƠ BẢN:

#dotline

#dotline

#dotline

#dotline

#dotline

#dotline

#dotline

#v(20pt)

#grid(columns: (1fr, auto), [3 - NỘI DUNG CÁC PHẦN THUYẾT MINH VÀ TÍNH TOÁN:], [Tỷ lệ %])

#dotline

#dotline

#dotline

#dotline

#dotline

#dotline

#dotline

#dotline

#dotline

#dotline

#dotline

#pagebreak()

5. GIÁO VIÊN HƯỚNG DẪN TỪNG PHẦN

#grid(columns: (1fr, 1fr), [#strong[Phần]], [Họ tên giáo viên hướng dẫn])

#dotline

#dotline

#dotline

#dotline

#v(24pt)

// Phần ký (mục 6 trở đi) dùng giãn dòng đơn, gọn như bản Word (line = 240),
// khác với các dòng chấm điền tay ở trên (giãn 1,5).
#set par(leading: 0.55em, spacing: 0.2em)

6. NGÀY GIAO NHIỆM VỤ ĐỒ ÁN TỐT NGHIỆP

#align(center)[Ngày ............ tháng ......... năm ....]

#v(22pt)

#grid(
  columns: (1fr, 1fr),
  column-gutter: 2.6cm,
  align(left)[
    #strong[Trưởng Bộ môn] \
    #emph[(Ký và ghi rõ Họ tên)]
  ],
  align(center)[
    #strong[Giáo viên hướng dẫn chính] \
    #emph[(Ký và ghi rõ Họ tên)]
  ],
)

#v(58pt)

Nhiệm vụ Đồ án tốt nghiệp đã được Hội đồng thi tốt nghiệp của Khoa thông qua

#align(right)[
  Ngày. . . . .tháng. . . . .năm .... \
  #strong[Chủ tịch Hội đồng] \
  #emph[(Ký và ghi rõ Họ tên)]
]

#v(50pt)

Sinh viên đã hoàn thành và nộp bản Đồ án tốt nghiệp cho Hội đồng thi ngày... tháng... năm ......

#align(right)[
  #strong[Sinh viên làm Đồ án tốt nghiệp] \
  #emph[(Ký và ghi rõ Họ tên)]
]
