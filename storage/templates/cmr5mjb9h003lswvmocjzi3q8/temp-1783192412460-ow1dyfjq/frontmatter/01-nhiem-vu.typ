// TỜ NHIỆM VỤ ĐỒ ÁN TỐT NGHIỆP — điền thông tin của bạn vào các chỗ trống.
// Biểu mẫu giữ màu theo mẫu Word của Trường: thân xanh, tiêu đề đỏ.
// Trang này KHÔNG đánh số (theo hướng dẫn trình bày).

#import "../styles/colors.typ": *
#import "../styles/utils.typ": mission-header

#pagebreak(weak: true)

#[
#set text(size: 13pt, fill: doc-blue)
#set par(justify: false, leading: 0.65em, spacing: 0.55em)

#mission-header()

#v(14pt)

#grid(
  columns: (9cm, 1fr),
  row-gutter: 0.6em,
  [Họ tên sinh viên: Nguyễn Văn A], [Hệ đào tạo: Chính quy],
  [Lớp: 64XXXX], [Ngành: Kỹ thuật phần mềm],
  [Khoa: Công nghệ thông tin], [],
)

#v(10pt)

1- TÊN ĐỀ TÀI:

#strong[XÂY DỰNG WEBSITE QUẢN LÝ ABC CHO ĐƠN VỊ XYZ]

#v(8pt)

2- CÁC TÀI LIỆU CƠ BẢN:

// Liệt kê 2–4 tài liệu nền tảng của đề tài (giáo trình, tài liệu chính thức…).
#[
  #set text(fill: doc-navy)
  #set par(hanging-indent: 0.9cm)
  \[1\]#h(0.3cm)Tác giả, _Tên tài liệu thứ nhất_, Nhà xuất bản, năm.

  \[2\]#h(0.3cm)Tác giả, _Tên tài liệu thứ hai_. \[Online\]. Available: đường dẫn.
]

#v(8pt)

3 - NỘI DUNG CÁC PHẦN THUYẾT MINH VÀ TÍNH TOÁN:

#table(
  columns: (12.6cm, 2.4cm),
  stroke: 0.5pt + ink,
  inset: (x: 5pt, y: 3pt),
  align: (x, y) => (if y == 0 or x == 1 { center } else { left }) + horizon,
  table.header([#strong[Nội dung cần thuyết minh]], [#strong[Tỷ lệ]]),
  [Chương 1: Giới thiệu tổng quan], [15%],
  [Chương 2: Giới thiệu các công nghệ, kĩ thuật sử dụng], [20%],
  [Chương 3: Phân tích thiết kế hệ thống], [40%],
  [Chương 4: Xây dựng website / phần mềm / hệ thống], [20%],
  [Kết luận], [5%],
)

#v(8pt)

4. GIÁO VIÊN HƯỚNG DẪN TỪNG PHẦN

#table(
  columns: (9.4cm, 5.6cm),
  stroke: 0.5pt + ink,
  inset: (x: 5pt, y: 3pt),
  align: (x, y) => (if y == 0 or x == 1 { center } else { left }) + horizon,
  table.header([#strong[Phần]], [#strong[Họ và tên giáo viên hướng dẫn]]),
  [Chương 1: Giới thiệu tổng quan], [ThS. Nguyễn Văn B],
  [Chương 2: Giới thiệu các công nghệ, kĩ thuật sử dụng], [ThS. Nguyễn Văn B],
  [Chương 3: Phân tích thiết kế hệ thống], [ThS. Nguyễn Văn B],
  [Chương 4: Xây dựng website / phần mềm / hệ thống], [ThS. Nguyễn Văn B],
  [Kết luận], [ThS. Nguyễn Văn B],
)

#v(8pt)

5. NGÀY GIAO NHIỆM VỤ ĐỒ ÁN TỐT NGHIỆP

#[
#set text(size: 11pt)

Ngày ............ tháng ......... năm 202

#v(6pt)

#grid(
  columns: (1fr, 1fr),
  column-gutter: 2.4cm,
  align(center)[
    #strong[Trưởng Bộ môn] \
    #emph[(Ký và ghi rõ Họ tên)]
  ],
  align(center)[
    #strong[Giáo viên hướng dẫn chính] \
    #emph[(Ký và ghi rõ Họ tên)]
  ],
)

#v(34pt)

Nhiệm vụ Đồ án tốt nghiệp đã được Hội đồng thi tốt nghiệp của Khoa thông qua

#align(right)[
  Ngày. . . . .tháng. . . . .năm 202 \
  #strong[Chủ tịch Hội đồng] \
  #emph[(Ký và ghi rõ Họ tên)]
]

#v(30pt)

Sinh viên đã hoàn thành và nộp bản Đồ án tốt nghiệp cho Hội đồng thi ngày... tháng... năm 202.

#align(right)[
  #strong[Sinh viên làm Đồ án tốt nghiệp] \
  #emph[(Ký và ghi rõ Họ tên)]
]
]
]
