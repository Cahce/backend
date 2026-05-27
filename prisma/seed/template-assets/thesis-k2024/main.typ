// Mẫu Luận Văn Tốt Nghiệp - Khóa 2024
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
    LUẬN VĂN TỐT NGHIỆP
  ]
  
  #v(1cm)
  
  #text(size: 16pt, weight: "bold")[
    TÊN ĐỀ TÀI LUẬN VĂN
  ]
  
  #v(3cm)
  
  #align(left)[
    #text(size: 13pt)[
      *Sinh viên thực hiện:* Họ và tên sinh viên \
      *MSSV:* 2251172XXX \
      *Lớp:* XXXXXX \
      *Khóa:* 2020 - 2024
      
      #v(1cm)
      
      *Giảng viên hướng dẫn:* TS. Họ và tên giảng viên
    ]
  ]
  
  #v(1fr)
  
  #text(size: 13pt)[
    Hà Nội, năm 2024
  ]
]

#pagebreak()

// Lời cảm ơn
#align(center)[
  #text(size: 14pt, weight: "bold")[LỜI CẢM ƠN]
]

#v(1cm)

Tôi xin chân thành cảm ơn...

(Nội dung lời cảm ơn)

#pagebreak()

// Mục lục
#outline(
  title: [MỤC LỤC],
  indent: auto,
)

#pagebreak()

// Danh sách hình ảnh
#outline(
  title: [DANH SÁCH HÌNH ẢNH],
  target: figure.where(kind: image),
)

#pagebreak()

// Danh sách bảng biểu
#outline(
  title: [DANH SÁCH BẢNG BIỂU],
  target: figure.where(kind: table),
)

#pagebreak()

// Nội dung chính
= GIỚI THIỆU

== Lý do chọn đề tài

(Nội dung lý do chọn đề tài)

== Mục tiêu nghiên cứu

=== Mục tiêu chung

(Nội dung mục tiêu chung)

=== Mục tiêu cụ thể

(Nội dung mục tiêu cụ thể)

== Đối tượng và phạm vi nghiên cứu

=== Đối tượng nghiên cứu

(Nội dung đối tượng nghiên cứu)

=== Phạm vi nghiên cứu

(Nội dung phạm vi nghiên cứu)

== Phương pháp nghiên cứu

(Nội dung phương pháp nghiên cứu)

== Ý nghĩa khoa học và thực tiễn

(Nội dung ý nghĩa)

== Cấu trúc luận văn

(Nội dung cấu trúc)

#pagebreak()

= CƠ SỞ LÝ THUYẾT

== Tổng quan về vấn đề nghiên cứu

(Nội dung tổng quan)

== Các khái niệm cơ bản

(Nội dung khái niệm)

== Các công trình nghiên cứu liên quan

(Nội dung công trình liên quan)

#pagebreak()

= PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG

== Phân tích yêu cầu

=== Yêu cầu chức năng

(Nội dung yêu cầu chức năng)

=== Yêu cầu phi chức năng

(Nội dung yêu cầu phi chức năng)

== Thiết kế hệ thống

=== Kiến trúc tổng thể

(Nội dung kiến trúc)

=== Thiết kế cơ sở dữ liệu

(Nội dung thiết kế CSDL)

=== Thiết kế giao diện

(Nội dung thiết kế giao diện)

#pagebreak()

= TRIỂN KHAI VÀ ĐÁNH GIÁ

== Môi trường triển khai

(Nội dung môi trường)

== Kết quả triển khai

(Nội dung kết quả)

== Đánh giá và kiểm thử

(Nội dung đánh giá)

#pagebreak()

= KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

== Kết luận

(Nội dung kết luận)

== Hạn chế

(Nội dung hạn chế)

== Hướng phát triển

(Nội dung hướng phát triển)

#pagebreak()

// Tài liệu tham khảo
#align(center)[
  #text(size: 14pt, weight: "bold")[TÀI LIỆU THAM KHẢO]
]

#v(1cm)

+ Tác giả 1. (Năm). _Tên sách hoặc bài báo_. Nhà xuất bản.

+ Tác giả 2. (Năm). _Tên sách hoặc bài báo_. Nhà xuất bản.

+ Tác giả 3. (Năm). _Tên sách hoặc bài báo_. Nhà xuất bản.

#pagebreak()

// Phụ lục
#align(center)[
  #text(size: 14pt, weight: "bold")[PHỤ LỤC]
]

#v(1cm)

== Phụ lục A: Mã nguồn chính

(Nội dung phụ lục)

== Phụ lục B: Kết quả khảo sát

(Nội dung phụ lục)
