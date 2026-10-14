#import "../styles/template.typ": frontmatter-title
#import "../styles/utils.typ": acronym-table
#import "../refs/acronyms.typ": acronyms

// MỤC LỤC + DANH MỤC — tất cả TỰ SINH, không cần sửa gì ở đây.
// (Từ viết tắt sửa trong refs/acronyms.typ.)

// --- Mục lục (tự sinh từ các đề mục cấp 1–3) ---
#frontmatter-title[Mục lục]
#outline(title: none, depth: 3, indent: n => (n - 1) * 1.2em)

// --- Danh mục hình ảnh (tự gom mọi hình có chú thích) ---
#frontmatter-title[Danh mục các hình ảnh]
#outline(title: none, target: figure.where(kind: image))

// --- Danh mục bảng biểu (tự gom mọi bảng có chú thích) ---
#frontmatter-title[Danh mục bảng biểu]
#outline(title: none, target: figure.where(kind: table))

// --- Danh mục từ viết tắt ---
#frontmatter-title[Danh mục các từ viết tắt và giải thích các thuật ngữ]
#acronym-table(acronyms)
