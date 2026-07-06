# Mẫu Đồ án tốt nghiệp — Xây dựng Phần mềm / Website

Khuôn quyển ĐATN theo "Hướng dẫn trình bày ĐATN" của Trường Đại học Thủy lợi và
cấu trúc chương của Bộ môn (đồ án dạng xây dựng phần mềm/website). **ĐATN từ 40
đến 80 trang.**

## Bắt đầu nhanh

1. **Bìa**: sửa các biến ở đầu `frontmatter/00-bia.typ` (họ tên, đề tài, ngành, GVHD, năm).
2. **Tờ nhiệm vụ**: điền `frontmatter/01-nhiem-vu.typ`.
3. **Nội dung**: viết vào `chapters/` — chữ *nghiêng* là hướng dẫn, thay bằng bài của bạn.
   Mỗi chương có ghi **hạn nộp** của Bộ môn trong chú thích đầu tệp.
4. **Trích dẫn**: thêm mục vào `refs/bibliography.bib`, trích trong bài bằng `#cite(<khóa>)`
   — số `[n]` và mục Tài liệu tham khảo tự cập nhật theo kiểu IEEE.
5. **Hình/bảng**: đặt ảnh vào `assets/images/` rồi thay khung giữ chỗ bằng
   `#fig("../assets/images/ten-anh.png", [chú thích])`. Mục lục, danh mục hình/bảng
   tự sinh — không phải gõ tay.

## Biên dịch

```sh
typst compile --font-path assets/fonts main.typ main.pdf   # hoặc: make pdf
```

Trên TLU Scholar Editor: mở dự án và bấm biên dịch (tệp chính là `main.typ`).

## Cấu trúc

| Phần | Tệp |
|---|---|
| Bìa chính + phụ | `frontmatter/00-bia.typ` |
| Tờ nhiệm vụ ĐATN | `frontmatter/01-nhiem-vu.typ` |
| Lời cam đoan / cám ơn | `frontmatter/02…03` |
| Mục lục + danh mục (tự sinh) | `frontmatter/04-danh-muc.typ` |
| Mở đầu (≈1 trang) | `chapters/00-mo-dau.typ` |
| Chương 1. Giới thiệu tổng quan | `chapters/01-gioi-thieu.typ` |
| Chương 2. Công nghệ, kĩ thuật sử dụng | `chapters/02-cong-nghe.typ` |
| Chương 3. Phân tích thiết kế hệ thống | `chapters/03-phan-tich-thiet-ke.typ` |
| Chương 4. Xây dựng hệ thống | `chapters/04-xay-dung.typ` |
| Kết luận | `chapters/05-ket-luan.typ` |
| Tài liệu tham khảo | `refs/bibliography.bib` (tự sinh danh mục) |
| Phụ lục (tùy chọn) | `chapters/06-phu-luc.typ` |

Quy cách trình bày (khổ A4, lề 3/2/2,5/2,5 cm, Times New Roman 13pt giãn 1,5;
CHƯƠNG 14pt đậm HOA; Hình/Bảng đánh số theo chương; trang bìa + nhiệm vụ không
đánh số, cam đoan → danh mục đánh i/ii/iii, nội dung đánh 1/2/3) đã cài sẵn
trong `styles/template.typ` — không cần chỉnh gì thêm.
