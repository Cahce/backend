#import "../styles/template.typ": frontmatter-title
#import "../styles/utils.typ": acronym-table
#import "../refs/acronyms.typ": acronyms

// --- Mục lục (tự sinh từ các đề mục) ---
// indent cố định theo cấp (không dùng auto) để các mục không đánh số của
// Mở đầu / Kết luận thẳng hàng với các mục 1.1, 1.2…
#frontmatter-title[Mục lục]
#outline(title: none, depth: 3, indent: n => (n - 1) * 1.2em)

// --- Danh mục từ viết tắt (sửa dữ liệu tại refs/acronyms.typ) ---
#frontmatter-title[Danh mục các từ viết tắt]
#acronym-table(acronyms)

// --- Danh mục hình (tự gom mọi hình có chú thích) ---
#frontmatter-title[Danh mục hình ảnh]
#outline(title: none, target: figure.where(kind: image))

// --- Danh mục bảng (tự gom mọi bảng có chú thích) ---
#frontmatter-title[Danh mục bảng biểu]
#outline(title: none, target: figure.where(kind: table))
