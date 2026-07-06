// Các hàm (functions) và macro tự viết hỗ trợ định dạng tài liệu

// Hàm tạo khoảng trống dọc
#let v-space(height) = {
  v(height)
}

// Hàm vẽ đường kẻ ngang phân cách
#let horizontal-line(thickness: 0.5pt, length: 100%, color: black) = {
  line(length: length, stroke: thickness + color)
}

// Hàm hỗ trợ tạo khung chữ ký cho Lời cam đoan/Lời cảm ơn bên lề phải
#let signature-block(
  title: "Tác giả BCTTTN",
  subtitle: "(Ký và ghi rõ họ tên)",
  name: "Nguyễn Văn A"
) = {
  align(right)[
    #box(width: 200pt)[
      #align(center)[
        #title \
        #if subtitle != "" [
          #text(style: "italic")[#subtitle] \
        ]
        #v(40pt)
        #strong(name)
      ]
    ]
  ]
}
