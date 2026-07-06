// main.typ — Mẫu BÁO CÁO NGHIÊN CỨU KHOA HỌC (Trường Đại học Thủy lợi).
//
// Cấu trúc chuẩn:
//   Trang bìa → Lời cam đoan → Mục lục → Danh mục từ viết tắt / hình / bảng
//   → Mở đầu → Chương 1..4 → Kết luận và Kiến nghị → Tài liệu tham khảo → Phụ lục
//
// Đánh số trang: bìa không đánh số; cam đoan → danh mục: i, ii, iii…;
// từ Mở đầu: 1, 2, 3…
//
// Biên dịch:  typst compile --font-path assets/fonts main.typ main.pdf
// Cần thêm/bớt chương: thêm/xoá dòng #include tương ứng ở dưới.

#import "styles/template.typ": thesis

#show: thesis

// ===================== TRANG BÌA (không đánh số) ====================
#set page(numbering: none)
#include "frontmatter/00-bia.typ"

// ================== PHẦN MỞ ĐẦU (i, ii, iii…) ======================
#set page(numbering: "i")
#counter(page).update(1)
#include "frontmatter/01-cam-doan.typ"
#include "frontmatter/02-danh-muc.typ"

// ==================== PHẦN NỘI DUNG (1, 2, 3…) =====================
#set page(numbering: "1")
#counter(page).update(1)
#include "chapters/00-mo-dau.typ"
#include "chapters/01-tong-quan.typ"
#include "chapters/02-co-so-ly-thuyet.typ"
#include "chapters/03-ket-qua.typ"
#include "chapters/04-danh-gia.typ"
#include "chapters/05-ket-luan.typ"

// ===================== TÀI LIỆU THAM KHẢO ==========================
// Danh mục sinh tự động từ refs/bibliography.bib, đánh số [1], [2]… theo
// thứ tự trích dẫn trong bài. Đặt tiếng Anh riêng phần này để ra đúng
// định dạng IEEE chuẩn (Accessed / [Online] / Available).
#heading(level: 1, numbering: none, outlined: true)[TÀI LIỆU THAM KHẢO]
// Ba dòng #cite(form: none) đưa các tài liệu CHƯA trích trong bài vào danh mục
// để minh họa đủ 4 dạng (hội nghị, tạp chí, sách, trực tuyến) — xoá khi đã
// trích thật trong nội dung hoặc không cần mục đó.
#cite(<ref2>, form: none)
#cite(<ref3>, form: none)
#cite(<ref4>, form: none)
#[
  #set text(lang: "en")
  #bibliography("refs/bibliography.bib", style: "ieee", title: none)
]

// ============================ PHỤ LỤC ==============================
#include "chapters/06-phu-luc.typ"
