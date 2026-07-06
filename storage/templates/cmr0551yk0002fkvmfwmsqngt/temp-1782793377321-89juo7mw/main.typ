#import "styles/template.typ": project

// Áp dụng template với các thông tin cá nhân của sinh viên
#show: project.with(
  title: "Tối ưu hóa vận hành hồ chứa thủy điện và đánh giá hiệu quả năng lượng công trình thủy điện trị an",
  student-name: "Nguyễn Văn A",
  student-id: "185106xxxx",
  class-name: "60TD - Thủy điện và Công trình năng lượng",
  mentor-name: "TS. Nguyễn Văn B",
  year: "2018",
)

// ==========================================
// PHẦN MỞ ĐẦU (Đánh số trang La Mã i, ii, iii...)
// ==========================================

// Lời cam đoan và Lời cảm ơn
#include "chapters/00-abstract.typ"

// Mục lục tự động
#pagebreak()
#heading(level: 1, numbering: none)[MỤC LỤC]
#outline(title: none, depth: 3, indent: 1.5em)

// Danh mục hình ảnh tự động
#pagebreak()
#heading(level: 1, numbering: none)[DANH MỤC CÁC HÌNH ẢNH]
#outline(title: none, target: figure.where(kind: image))

// Danh mục bảng biểu tự động
#pagebreak()
#heading(level: 1, numbering: none)[DANH MỤC BẢNG BIỂU]
#outline(title: none, target: figure.where(kind: table))

// Danh mục từ viết tắt
#pagebreak()
#include "refs/acronyms.typ"

// ==========================================
// PHẦN NỘI DUNG (Đánh số trang Ả Rập 1, 2, 3...)
// ==========================================
#pagebreak()

// Thiết lập đánh số trang Ả Rập bắt đầu từ 1
#set page(
  numbering: "1",
  footer: context {
    let page-num = counter(page).display("1")
    align(center)[
      #v(10pt)
      #text(size: 13pt)[#page-num]
    ]
  }
)
#counter(page).update(1) // Reset trang về 1 cho chương đầu tiên

// Bắt đầu đánh số cho các tiêu đề (Heading) từ đây
#set heading(numbering: "1.1.1.1")

// Include các chương nội dung
#include "chapters/01-intro.typ"
#include "chapters/02-methodology.typ"
#include "chapters/03-results.typ"

// ==========================================
// TÀI LIỆU THAM KHẢO (Đánh số trang tiếp tục, không đánh số chương)
// ==========================================
#pagebreak()
#heading(level: 1, numbering: none)[TÀI LIỆU THAM KHẢO]
#bibliography("refs/bibliography.bib", title: none, style: "ieee")

// ==========================================
// PHỤ LỤC (Đánh số trang tiếp tục, không đánh số chương)
// ==========================================
#pagebreak()
#heading(level: 1, numbering: none)[PHỤ LỤC]

Phần phụ lục bao gồm những bổ sung hỗ trợ cho nội dung BCTTTN như số liệu, biểu mẫu, mã chương trình, hình ảnh, tài liệu minh chứng, … nhằm làm rõ các kết quả đã trình bày trong phần nội dung. Các tính toán đã trình bày tóm tắt trong phần nội dung phải được trình bày chi tiết trong phần phụ lục này.
