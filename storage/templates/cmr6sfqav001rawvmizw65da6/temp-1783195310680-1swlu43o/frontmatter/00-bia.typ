// TRANG BÌA — sửa các biến dưới đây theo đề tài của nhóm.
// Kiểu chữ theo mẫu báo cáo NCKH: tên trường/khoa 20pt đậm, tiêu đề 18pt đậm,
// thông tin nhóm 15pt đậm, nơi – thời gian 15pt nghiêng.

#let TEN-KHOA = [KHOA CÔNG NGHỆ THÔNG TIN]
#let TEN-DE-TAI = [Xây dựng mô hình học sâu nhận dạng khuôn mặt hỗ trợ cho việc chấm công]
#let NHOM-SINH-VIEN = (
  "Vương Tất Chiến - 64KTPM4",
  "Phạm Đông Vũ - 64KTPM4",
  "Trịnh Ngọc Sơn - 64KTPM4",
  "Lý Duy Bách - 64KTPM4",
  "Phạm Văn Dũng - 64KTPM.NB",
)
#let GIANG-VIEN-HD = [TS. Tạ Quang Chiểu]
#let NOI-THOI-GIAN = [Hà Nội, 4/2025]

#align(center)[
  #set par(leading: 0.8em, justify: false)
  #text(size: 20pt, weight: "bold")[TRƯỜNG ĐẠI HỌC THỦY LỢI]

  #text(size: 20pt, weight: "bold")[#TEN-KHOA]

  #v(16pt)
  #image("../assets/images/logo-tlu.png", width: 4cm)
  #v(20pt)

  #text(size: 18pt, weight: "bold")[BÁO CÁO NGHIÊN CỨU KHOA HỌC]

  #v(10pt)
  #text(size: 18pt, weight: "bold")[Đề tài: #TEN-DE-TAI]

  #v(34pt)
  // Danh sách nhóm: dòng đầu có nhãn, các dòng sau thẳng cột tên.
  #grid(
    columns: (auto, auto),
    column-gutter: 0.5em,
    row-gutter: 0.7em,
    align: (right, left),
    text(size: 15pt, weight: "bold")[Sinh viên thực hiện:],
    text(size: 15pt, weight: "bold")[#NHOM-SINH-VIEN.first()],
    ..NHOM-SINH-VIEN.slice(1).map(sv => ([], text(size: 15pt, weight: "bold")[#sv])).flatten(),
  )

  #v(10pt)
  #text(size: 15pt, weight: "bold")[Khoa: Công nghệ thông tin]

  #text(size: 15pt, weight: "bold")[Giảng viên hướng dẫn: #GIANG-VIEN-HD]

  #v(1fr)
  #text(size: 15pt, style: "italic")[#NOI-THOI-GIAN]
]
