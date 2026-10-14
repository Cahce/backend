#import "../styles/utils.typ": *

// CHƯƠNG 3 — HẠN NỘP: trước 11/5/2026.
// Đủ các mục theo cấu trúc Bộ môn: mô tả/đặc tả bài toán, sơ đồ phân rã chức
// năng, use case tổng quát, luồng sự kiện cho các use case, biểu đồ activity,
// biểu đồ tuần tự, biểu đồ lớp (bỏ nếu không lập trình hướng đối tượng),
// thiết kế CSDL, thiết kế giao diện.

= PHÂN TÍCH THIẾT KẾ HỆ THỐNG

== Mô tả bài toán

_Đặc tả bài toán: các tác nhân, yêu cầu chức năng (liệt kê theo nhóm) và yêu cầu phi chức năng (hiệu năng, bảo mật, khả dụng…)._

== Sơ đồ phân rã chức năng

_Phân rã hệ thống từ chức năng tổng quát thành các nhóm chức năng con._

#fig-placeholder([sơ đồ phân rã chức năng], [Sơ đồ phân rã chức năng của hệ thống])

== Sơ đồ use case tổng quát

_Biểu đồ use case tổng quát với các tác nhân và nhóm chức năng chính; mô tả ngắn từng use case._

#fig-placeholder([sơ đồ use case tổng quát], [Biểu đồ use case tổng quát])

== Luồng sự kiện cho các use case

_Với mỗi use case chính, lập bảng đặc tả luồng sự kiện. Nhân bản bảng mẫu dưới đây cho từng use case:_

#tbl(
  [Đặc tả use case "Tên use case"],
  table(
    columns: (3.2cm, 12.7cm),
    table.header([*Mục*], [*Nội dung*]),
    [Mã use case], [UC01],
    [Tên use case], [_Tên use case_],
    [Tác nhân], [_Ai thực hiện_],
    [Mô tả], [_Use case làm gì_],
    [Điều kiện trước], [_Trạng thái cần có trước khi thực hiện_],
    [Điều kiện sau], [_Kết quả sau khi thực hiện thành công_],
    [Luồng chính], [1\. _Bước thứ nhất._ \ 2\. _Bước thứ hai._ \ 3\. _Bước thứ ba._],
    [Luồng thay thế], [A1 -- _Nhánh thay thế (nếu có)._],
    [Ngoại lệ], [E1: _Tình huống lỗi_ → _cách hệ thống xử lý._],
  ),
)

== Biểu đồ activity

_Mỗi use case chính kèm một biểu đồ hoạt động thể hiện luồng xử lý giữa người dùng và hệ thống._

#fig-placeholder([biểu đồ activity cho use case chính], [Biểu đồ hoạt động: tên chức năng])

== Biểu đồ tuần tự

_Biểu đồ tuần tự cho các luồng quan trọng (đăng nhập, nghiệp vụ cốt lõi…)._

#fig-placeholder([biểu đồ tuần tự cho luồng chính], [Biểu đồ tuần tự: tên luồng])

== Biểu đồ lớp

// Nếu KHÔNG lập trình hướng đối tượng thì bỏ tiểu mục này (xoá cả khối).
_Biểu đồ lớp mức thiết kế: các lớp chính, thuộc tính, phương thức và quan hệ._

#fig-placeholder([biểu đồ lớp của hệ thống], [Biểu đồ lớp])

== Thiết kế cơ sở dữ liệu

_Lược đồ quan hệ / ERD; kèm bảng mô tả chi tiết các bảng dữ liệu quan trọng:_

#fig-placeholder([lược đồ cơ sở dữ liệu (ERD)], [Lược đồ cơ sở dữ liệu])

#tbl(
  [Mô tả bảng dữ liệu "ten_bang"],
  table(
    columns: (3.4cm, 3cm, 2.6cm, 6.9cm),
    table.header([*Tên cột*], [*Kiểu dữ liệu*], [*Ràng buộc*], [*Mô tả*]),
    [id], [BIGINT], [PK], [_Khóa chính_],
    [ten_cot], [VARCHAR(255)], [NOT NULL], [_Ý nghĩa cột_],
  ),
)

== Thiết kế giao diện

_Phác thảo (wireframe/mockup) các màn hình chính và mô tả bố cục, luồng điều hướng._

#fig-placeholder([phác thảo màn hình chính], [Thiết kế giao diện màn hình chính])
