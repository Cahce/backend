#import "../styles/utils.typ": *

= KẾT QUẢ NGHIÊN CỨU

_Chương này trình bày số liệu phân tích, kết quả thực nghiệm hoặc mô phỏng của đề tài._

== Chuẩn bị dữ liệu và môi trường thực nghiệm

_Mô tả bộ dữ liệu (nguồn, quy mô, cách chia tập), môi trường phần cứng/phần mềm và các bước tiến hành thực nghiệm._

== Kết quả thực nghiệm

_Trình bày kết quả bằng bảng số liệu và hình vẽ; mỗi kết quả kèm nhận xét ngắn._

#tbl(
  [Kết quả thực nghiệm của các phương án (ví dụ)],
  table(
    columns: (5cm, 3.6cm, 3.6cm, 3.7cm),
    table.header([*Phương án*], [*Accuracy*], [*Precision*], [*Recall*]),
    [Phương án 1], [--], [--], [--],
    [Phương án 2], [--], [--], [--],
  ),
)

#fig-placeholder([biểu đồ so sánh kết quả giữa các phương án], [Biểu đồ so sánh kết quả thực nghiệm])

== Phân tích kết quả

_Phân tích sâu các số liệu: xu hướng, khác biệt giữa các phương án, nguyên nhân; đối chiếu với kết quả của các nghiên cứu trước khi phù hợp._
