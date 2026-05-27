// Mẫu Báo Cáo Thực Tập Tốt Nghiệp
// Trường Đại học Thủy Lợi

#set page(
  paper: "a4",
  margin: (left: 3cm, right: 2cm, top: 2cm, bottom: 2cm),
  numbering: "1",
)

#set text(
  font: "New Computer Modern",
  size: 13pt,
  lang: "vi",
)

#set par(
  justify: true,
  leading: 1em,
  first-line-indent: 1.5em,
)

#set heading(numbering: "1.1")

// Trang bìa
#align(center)[
  #text(size: 14pt, weight: "bold")[
    TRƯỜNG ĐẠI HỌC THỦY LỢI \
    KHOA CÔNG NGHỆ THÔNG TIN
  ]
  
  #v(3cm)
  
  #text(size: 18pt, weight: "bold")[
    BÁO CÁO THỰC TẬP TỐT NGHIỆP
  ]
  
  #v(1cm)
  
  #text(size: 16pt, weight: "bold")[
    TÊN ĐƠN VỊ THỰC TẬP
  ]
  
  #v(3cm)
  
  #align(left)[
    #text(size: 13pt)[
      *Sinh viên thực hiện:* Họ và tên sinh viên \
      *MSSV:* 2251172XXX \
      *Lớp:* XXXXXX \
      *Khóa:* 2020 - 2024
      
      #v(1cm)
      
      *Giảng viên hướng dẫn:* TS. Họ và tên giảng viên \
      *Cán bộ hướng dẫn tại đơn vị:* Họ và tên cán bộ
    ]
  ]
  
  #v(1fr)
  
  #text(size: 13pt)[
    Hà Nội, năm 2024
  ]
]

#pagebreak()

// Mục lục
#outline(
  title: [MỤC LỤC],
  indent: auto,
)

#pagebreak()

// Nội dung chính
= THÔNG TIN CHUNG VỀ ĐƠN VỊ THỰC TẬP

== Giới thiệu về đơn vị

(Nội dung giới thiệu đơn vị)

== Lịch sử hình thành và phát triển

(Nội dung lịch sử)

== Cơ cấu tổ chức

(Nội dung cơ cấu tổ chức)

== Lĩnh vực hoạt động

(Nội dung lĩnh vực hoạt động)

#pagebreak()

= NỘI DUNG THỰC TẬP

== Thời gian và địa điểm thực tập

*Thời gian:* Từ ngày ... đến ngày ...

*Địa điểm:* ...

*Phòng ban:* ...

== Nhiệm vụ được giao

(Nội dung nhiệm vụ)

== Quá trình thực hiện

=== Tuần 1-2: Làm quen với môi trường

(Nội dung tuần 1-2)

=== Tuần 3-4: Tìm hiểu nghiệp vụ

(Nội dung tuần 3-4)

=== Tuần 5-8: Thực hiện công việc

(Nội dung tuần 5-8)

== Kết quả đạt được

(Nội dung kết quả)

#pagebreak()

= KIẾN THỨC VÀ KỸ NĂNG ỨNG DỤNG

== Kiến thức chuyên môn

(Nội dung kiến thức chuyên môn)

== Công nghệ và công cụ sử dụng

(Nội dung công nghệ)

== Kỹ năng mềm

(Nội dung kỹ năng mềm)

#pagebreak()

= ĐÁNH GIÁ VÀ RÚT KINH NGHIỆM

== Đánh giá chung

(Nội dung đánh giá)

== Những khó khăn gặp phải

(Nội dung khó khăn)

== Bài học kinh nghiệm

(Nội dung bài học)

== Kiến nghị

(Nội dung kiến nghị)

#pagebreak()

= KẾT LUẬN

(Nội dung kết luận)

#pagebreak()

// Tài liệu tham khảo
#align(center)[
  #text(size: 14pt, weight: "bold")[TÀI LIỆU THAM KHẢO]
]

#v(1cm)

+ Tài liệu nội bộ của đơn vị thực tập

+ Tài liệu hướng dẫn sử dụng các công cụ

#pagebreak()

// Phụ lục
#align(center)[
  #text(size: 14pt, weight: "bold")[PHỤ LỤC]
]

#v(1cm)

== Phụ lục A: Nhật ký thực tập

(Nội dung nhật ký)

== Phụ lục B: Hình ảnh minh họa

(Nội dung hình ảnh)

== Phụ lục C: Đánh giá của đơn vị

(Nội dung đánh giá)
