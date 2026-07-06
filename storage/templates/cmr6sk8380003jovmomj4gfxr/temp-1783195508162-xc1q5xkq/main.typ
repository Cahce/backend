// main.typ — Tệp gốc biên dịch ra PDF của quyển ĐATN (khuôn mẫu).
//
// LƯU Ý: ĐATN từ 40 đến 80 trang (không kể phụ lục).
//
// Thứ tự các phần theo "Hướng dẫn trình bày ĐATN" của Trường:
//   1. Bìa chính + bìa phụ + Tờ nhiệm vụ  → KHÔNG đánh số trang
//   2. Lời cam đoan → Danh mục            → i, ii, iii…
//   3. Mở đầu → Chương 1..4 → Kết luận → Tài liệu tham khảo (→ Phụ lục) → 1, 2, 3…
//
// Cách dùng nhanh:
//   • Sửa thông tin bìa trong frontmatter/00-bia.typ (các biến ở đầu file).
//   • Điền tờ nhiệm vụ trong frontmatter/01-nhiem-vu.typ.
//   • Viết nội dung trong chapters/ (chữ nghiêng là hướng dẫn — thay bằng bài của bạn).
//   • Thêm tài liệu tham khảo vào refs/bibliography.bib, trích bằng #cite(<khóa>).
//   • Biên dịch: typst compile --font-path assets/fonts main.typ main.pdf

#import "styles/template.typ": thesis

#show: thesis

// ============ PHẦN BÌA + BIỂU MẪU (không đánh số trang) ============
#set page(numbering: none)
#include "frontmatter/00-bia.typ"
#include "frontmatter/01-nhiem-vu.typ"

// ================== PHẦN MỞ ĐẦU (i, ii, iii…) ======================
#set page(numbering: "i")
#counter(page).update(1)
#include "frontmatter/02-cam-doan.typ"
#include "frontmatter/03-cam-on.typ"
#include "frontmatter/04-danh-muc.typ"

// ==================== PHẦN NỘI DUNG (1, 2, 3…) =====================
#set page(numbering: "1")
#counter(page).update(1)
#include "chapters/00-mo-dau.typ"
#include "chapters/01-gioi-thieu.typ"
#include "chapters/02-cong-nghe.typ"
#include "chapters/03-phan-tich-thiet-ke.typ"
#include "chapters/04-xay-dung.typ"
#include "chapters/05-ket-luan.typ"

// ===================== TÀI LIỆU THAM KHẢO ==========================
// Danh mục sinh tự động từ refs/bibliography.bib theo kiểu IEEE.
#heading(level: 1, numbering: none, outlined: true)[TÀI LIỆU THAM KHẢO]
// Hai dòng #cite(form: none) đưa tài liệu CHƯA trích trong bài vào danh mục
// (để minh họa) — xoá khi đã trích thật hoặc không cần.
#cite(<ref2>, form: none)
#cite(<ref3>, form: none)
#[
  #set text(lang: "en")
  #bibliography("refs/bibliography.bib", style: "ieee", title: none)
]

// ===================== PHỤ LỤC (tùy chọn) ==========================
// Bỏ chú thích dòng dưới nếu đồ án có phụ lục (tối đa 30 trang).
// #include "chapters/06-phu-luc.typ"
