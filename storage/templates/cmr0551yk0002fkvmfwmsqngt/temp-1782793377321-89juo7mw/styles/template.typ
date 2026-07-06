// Định nghĩa cấu trúc trang, phông chữ, heading cho toàn dự án BCTTTN
#import "colors.typ": *

#let project(
  title: "TÊN CÔNG TRÌNH VÀ NỘI DUNG CHÍNH CỦA BÁO CÁO THỰC TẬP TỐT NGHIỆP",
  student-name: "HỌ TÊN SINH VIÊN",
  student-id: "MSV123456",
  class-name: "LỚP THỦY ĐIỆN",
  mentor-name: "TS. NGUYỄN VĂN B",
  year: "201…",
  body
) = {
  // Cấu hình tài liệu PDF
  set document(title: title, author: student-name)
  
  // Thiết lập phông chữ mặc định là Times New Roman, cỡ 13pt
  set text(
    font: "Times New Roman",
    size: 13pt,
    lang: "vi",
    fill: primary-black
  )
  
  // Thiết lập trang bìa chính
  // Lề giấy: lề trên 2.5 cm, lề dưới 2.5 cm, lề trái 3 cm, lề phải 2 cm
  set page(
    paper: "a4",
    margin: (top: 2.5cm, bottom: 2.5cm, left: 3cm, right: 2cm),
    numbering: none,
    footer: none,
    header: none
  )
  
  // Trang bìa chính
  align(center)[
    #text(size: 13pt)[
      #grid(
        columns: (1fr, 1fr),
        align(center)[#strong("BỘ GIÁO DỤC VÀ ĐÀO TẠO")],
        align(center)[#strong("BỘ NÔNG NGHIỆP VÀ PTNT")]
      )
    ]
    #v(5pt)
    #text(size: 14pt)[#strong("TRƯỜNG ĐẠI HỌC THỦY LỢI")]
    
    #v(30pt)
    #image("../assets/images/tlu-logo.png", width: 3.5cm)
    
    #v(35pt)
    #text(size: 14pt)[#strong("HỌ TÊN SINH VIÊN: " + upper(student-name))]
    
    #v(35pt)
    #text(size: 15pt)[#strong("BÁO CÁO THỰC TẬP TỐT NGHIỆP")] \
    #v(8pt)
    #text(size: 13pt)[#strong("CHUYÊN NGÀNH THỦY ĐIỆN VÀ CÔNG TRÌNH NĂNG LƯỢNG")]
    
    #v(40pt)
    #align(left)[
      #text(size: 13pt)[#strong("Tên công trình và nội dung chính:")]
    ]
    #v(10pt)
    #text(size: 14pt)[#strong(upper(title))]
    
    #v(60pt)
    #align(left)[
      #pad(left: 2cm)[
        #grid(
          columns: (auto, auto),
          row-gutter: 12pt,
          column-gutter: 15pt,
          text(size: 13pt)[Sinh viên thực hiện:], text(size: 13pt)[#strong(student-name)],
          text(size: 13pt)[Mã số sinh viên:], text(size: 13pt)[#strong(student-id)],
          text(size: 13pt)[Lớp:], text(size: 13pt)[#strong(class-name)],
          text(size: 13pt)[Người hướng dẫn:], text(size: 13pt)[#strong(mentor-name)],
        )
      ]
    ]
    
    #v(90pt)
    #text(size: 13pt)[#strong("HÀ NỘI, NĂM " + year)]
  ]
  
  pagebreak()
  
  // Thiết lập trang bìa phụ (theo mẫu giống bìa chính nhưng không có logo hoặc in đen trắng)
  align(center)[
    #text(size: 13pt)[
      #grid(
        columns: (1fr, 1fr),
        align(center)[#strong("BỘ GIÁO DỤC VÀ ĐÀO TẠO")],
        align(center)[#strong("BỘ NÔNG NGHIỆP VÀ PTNT")]
      )
    ]
    #v(5pt)
    #text(size: 14pt)[#strong("TRƯỜNG ĐẠI HỌC THỦY LỢI")]
    
    #v(50pt)
    #text(size: 14pt)[#strong("HỌ TÊN SINH VIÊN: " + upper(student-name))]
    
    #v(40pt)
    #text(size: 15pt)[#strong("BÁO CÁO THỰC TẬP TỐT NGHIỆP")] \
    #v(8pt)
    #text(size: 13pt)[#strong("CHUYÊN NGÀNH THỦY ĐIỆN VÀ CÔNG TRÌNH NĂNG LƯỢNG")]
    
    #v(40pt)
    #align(left)[
      #text(size: 13pt)[#strong("Tên công trình và nội dung chính:")]
    ]
    #v(10pt)
    #text(size: 14pt)[#strong(upper(title))]
    
    #v(70pt)
    #align(left)[
      #pad(left: 2cm)[
        #grid(
          columns: (auto, auto),
          row-gutter: 12pt,
          column-gutter: 15pt,
          text(size: 13pt)[Sinh viên thực hiện:], text(size: 13pt)[#strong(student-name)],
          text(size: 13pt)[Mã số sinh viên:], text(size: 13pt)[#strong(student-id)],
          text(size: 13pt)[Lớp:], text(size: 13pt)[#strong(class-name)],
          text(size: 13pt)[Người hướng dẫn:], text(size: 13pt)[#strong(mentor-name)],
        )
      ]
    ]
    
    #v(110pt)
    #text(size: 13pt)[#strong("HÀ NỘI, NĂM " + year)]
  ]

  pagebreak()

  // Cấu hình cho phần mở đầu: Đánh số trang dạng i, ii, iii, ... bắt đầu từ Lời cam đoan
  // Footer cách đáy 0.5 cm
  set page(
    numbering: "i",
    footer: context {
      let page-num = counter(page).display("i")
      align(center)[
        #v(10pt)
        #text(size: 13pt)[#page-num]
      ]
    }
  )
  counter(page).update(1) // Bắt đầu Lời cam đoan là trang i
  
  // Cấu hình paragraph chung cho nội dung (cỡ 13pt, line spacing: 1.5, spacing: 10pt)
  // Trong Typst, line spacing 1.5 tương ứng với leading khoảng 0.85em
  set par(
    justify: true,
    leading: 0.85em,
    spacing: 10pt
  )
  
  // Quy tắc đánh số cho heading tối đa 4 chữ số
  set heading(
    numbering: (..args) => {
      let nums = args.pos()
      if nums.len() <= 4 {
        nums.map(str).join(".")
      }
    }
  )
  
  // Định nghĩa hiển thị Heading
  show heading: it => {
    // Không thụt đầu hàng cho tất cả các heading
    set par(first-line-indent: 0pt)
    
    if it.level == 1 {
      // Heading 1 (Chương): Tên chương in đậm, in hoa, cỡ 14pt, Spacing Before: 24pt, Spacing After: 24pt, Line spacing: single (leading: 0.4em), căn lề trái
      v(24pt)
      block(width: 100%, below: 24pt)[
        #set text(size: 14pt, weight: "bold")
        #set par(leading: 0.4em)
        #if it.numbering != none {
          let chap-num = counter(heading).at(it.location()).at(0)
          let upper-title = upper(it.body)
          [CHƯƠNG #chap-num \ #upper-title]
        } else {
          let upper-title = upper(it.body)
          [#upper-title]
        }
      ]
    } else if it.level == 2 {
      // Heading 2 (Tiểu mục thứ nhất): Cỡ 13pt, in đậm, Spacing Before: 6pt, Spacing After: 12pt, Line spacing: single, căn lề trái
      v(6pt)
      block(width: 100%, below: 12pt)[
        #set text(size: 13pt, weight: "bold")
        #set par(leading: 0.4em)
        #it
      ]
    } else if it.level == 3 {
      // Heading 3 (Tiểu mục thứ hai): Cỡ 13pt, in đậm và nghiêng, Spacing Before: 6pt, Spacing After: 12pt, Line spacing: single, căn lề trái
      v(6pt)
      block(width: 100%, below: 12pt)[
        #set text(size: 13pt, weight: "bold", style: "italic")
        #set par(leading: 0.4em)
        #it
      ]
    } else if it.level == 4 {
      // Heading 4 (Tiểu mục thứ ba): Cỡ 13pt, in nghiêng, Spacing Before: 6pt, Spacing After: 12pt, Line spacing: single, căn lề trái
      v(6pt)
      block(width: 100%, below: 12pt)[
        #set text(size: 13pt, weight: "regular", style: "italic")
        #set par(leading: 0.4em)
        #it
      ]
    }
  }

  // Chú thích cho hình ảnh và bảng biểu (Caption): cỡ 13pt, line spacing single, căn giữa.
  // Hình chú thích ở dưới, bảng chú thích ở trên.
  show figure: it => {
    set text(size: 13pt)
    set align(center)
    if it.kind == image {
      // Chú thích hình ở dưới
      block(spacing: 10pt)[
        #it.body
        #v(6pt)
        #it.caption
      ]
    } else if it.kind == table {
      // Chú thích bảng ở trên
      block(spacing: 10pt)[
        #it.caption
        #v(6pt)
        #it.body
      ]
    } else {
      block(spacing: 10pt)[
        #it.body
        #it.caption
      ]
    }
  }

  // Định dạng danh sách bullet (giãn dòng 1.5, spacing 0)
  show list: set par(leading: 0.85em, spacing: 0pt)
  show enum: set par(leading: 0.85em, spacing: 0pt)

  body
}
