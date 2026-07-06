#import "../styles/utils.typ": *

= CƠ SỞ LÝ THUYẾT VÀ PHƯƠNG PHÁP NGHIÊN CỨU

_Chương này trình bày các mô hình toán, lý thuyết nền tảng hoặc thuật toán được sử dụng trong đề tài._

== Lý thuyết nền tảng

_Trình bày khái niệm, định nghĩa và mô hình lý thuyết làm nền cho nghiên cứu. Hình minh họa dùng lệnh `fig` (chú thích đặt dưới hình, tự đánh số theo chương):_

#fig-placeholder([sơ đồ/mô hình lý thuyết nền tảng], [Cấu trúc mô hình lý thuyết của đề tài])

== Các mô hình và thuật toán sử dụng

_Mô tả từng mô hình/thuật toán: ý tưởng, công thức toán, tham số chính. Công thức đặt giữa dòng như ví dụ dưới (tự đánh số khi cần tham chiếu):_

$ L = sum_(i=1)^N [ ||f(x_i^a) - f(x_i^p)||_2^2 - ||f(x_i^a) - f(x_i^n)||_2^2 + alpha ]_+ $

== Phương pháp thực hiện và đánh giá

_Trình bày quy trình thực hiện (thu thập -- tiền xử lý -- huấn luyện -- đánh giá) và các độ đo sử dụng. Bảng dùng lệnh `tbl` (chú thích đặt trên bảng):_

#tbl(
  [Các độ đo đánh giá sử dụng trong đề tài],
  table(
    columns: (4cm, 11.9cm),
    table.header([*Độ đo*], [*Ý nghĩa*]),
    [Accuracy], [Tỷ lệ dự đoán đúng trên tổng số mẫu],
    [Precision], [Tỷ lệ dự đoán dương đúng trên tổng dự đoán dương],
    [Recall], [Tỷ lệ dự đoán dương đúng trên tổng số mẫu dương thực tế],
  ),
)
