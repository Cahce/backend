// Mẫu Đề Cương Nghiên Cứu Khoa Học
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
    ĐỀ CƯƠNG NGHIÊN CỨU KHOA HỌC
  ]
  
  #v(1cm)
  
  #text(size: 16pt, weight: "bold")[
    TÊN ĐỀ TÀI NGHIÊN CỨU
  ]
  
  #v(3cm)
  
  #align(left)[
    #text(size: 13pt)[
      *Chủ nhiệm đề tài:* Họ và tên \
      *Đơn vị:* Khoa Công nghệ Thông tin \
      *Thời gian thực hiện:* 12 tháng
      
      #v(1cm)
      
      *Thành viên tham gia:*
      - Họ và tên thành viên 1
      - Họ và tên thành viên 2
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
= THÔNG TIN CHUNG VỀ ĐỀ TÀI

== Tên đề tài

(Tên đề tài bằng tiếng Việt và tiếng Anh)

== Lĩnh vực nghiên cứu

(Nội dung lĩnh vực)

== Thời gian thực hiện

*Thời gian:* 12 tháng

*Từ:* ... đến ...

== Kinh phí dự kiến

(Nội dung kinh phí)

#pagebreak()

= TÍNH CẤP THIẾT CỦA ĐỀ TÀI

== Đặt vấn đề

(Nội dung đặt vấn đề)

== Tính cấp thiết

(Nội dung tính cấp thiết)

== Tình hình nghiên cứu trong và ngoài nước

=== Trong nước

(Nội dung nghiên cứu trong nước)

=== Ngoài nước

(Nội dung nghiên cứu ngoài nước)

== Những vấn đề còn tồn tại

(Nội dung vấn đề tồn tại)

#pagebreak()

= MỤC TIÊU VÀ NỘI DUNG NGHIÊN CỨU

== Mục tiêu nghiên cứu

=== Mục tiêu chung

(Nội dung mục tiêu chung)

=== Mục tiêu cụ thể

+ Mục tiêu cụ thể 1
+ Mục tiêu cụ thể 2
+ Mục tiêu cụ thể 3

== Đối tượng và phạm vi nghiên cứu

=== Đối tượng nghiên cứu

(Nội dung đối tượng)

=== Phạm vi nghiên cứu

(Nội dung phạm vi)

== Nội dung nghiên cứu

=== Nội dung 1

(Mô tả nội dung 1)

=== Nội dung 2

(Mô tả nội dung 2)

=== Nội dung 3

(Mô tả nội dung 3)

#pagebreak()

= PHƯƠNG PHÁP NGHIÊN CỨU

== Phương pháp tiếp cận

(Nội dung phương pháp tiếp cận)

== Phương pháp thu thập dữ liệu

(Nội dung thu thập dữ liệu)

== Phương pháp xử lý và phân tích

(Nội dung xử lý và phân tích)

== Công cụ nghiên cứu

(Nội dung công cụ)

#pagebreak()

= KẾ HOẠCH THỰC HIỆN

== Giai đoạn 1 (Tháng 1-3): Nghiên cứu lý thuyết

(Nội dung giai đoạn 1)

== Giai đoạn 2 (Tháng 4-6): Thiết kế và phát triển

(Nội dung giai đoạn 2)

== Giai đoạn 3 (Tháng 7-9): Thử nghiệm và đánh giá

(Nội dung giai đoạn 3)

== Giai đoạn 4 (Tháng 10-12): Hoàn thiện và nghiệm thu

(Nội dung giai đoạn 4)

#pagebreak()

= SẢN PHẨM DỰ KIẾN

== Sản phẩm khoa học

+ Bài báo khoa học đăng trên tạp chí chuyên ngành
+ Báo cáo kết quả nghiên cứu
+ Mô hình/hệ thống thử nghiệm

== Sản phẩm ứng dụng

(Nội dung sản phẩm ứng dụng)

== Đào tạo

(Nội dung đào tạo)

#pagebreak()

= DỰ KIẾN KẾT QUẢ VÀ Ý NGHĨA

== Kết quả dự kiến

(Nội dung kết quả dự kiến)

== Ý nghĩa khoa học

(Nội dung ý nghĩa khoa học)

== Ý nghĩa thực tiễn

(Nội dung ý nghĩa thực tiễn)

== Khả năng ứng dụng và chuyển giao

(Nội dung ứng dụng và chuyển giao)

#pagebreak()

= DỰ TOÁN KINH PHÍ

#table(
  columns: (1fr, 2fr, 1fr, 1fr),
  align: (center, left, right, right),
  [*STT*], [*Nội dung chi*], [*Đơn giá*], [*Thành tiền*],
  [1], [Chi phí nhân công], [], [],
  [2], [Chi phí thiết bị và vật tư], [], [],
  [3], [Chi phí khảo sát và thu thập dữ liệu], [], [],
  [4], [Chi phí hội thảo và công bố], [], [],
  [5], [Chi phí quản lý], [], [],
  [], [*Tổng cộng*], [], [*...*],
)

#pagebreak()

// Tài liệu tham khảo
#align(center)[
  #text(size: 14pt, weight: "bold")[TÀI LIỆU THAM KHẢO]
]

#v(1cm)

+ Tác giả 1. (Năm). _Tên bài báo_. Tên tạp chí, số(tập), trang.

+ Tác giả 2. (Năm). _Tên sách_. Nhà xuất bản.

+ Tác giả 3. (Năm). _Tên bài báo_. Tên hội nghị, địa điểm.

#pagebreak()

// Phụ lục
#align(center)[
  #text(size: 14pt, weight: "bold")[PHỤ LỤC]
]

#v(1cm)

== Phụ lục A: Sơ đồ tổng quan hệ thống

(Nội dung phụ lục)

== Phụ lục B: Kết quả khảo sát sơ bộ

(Nội dung phụ lục)
