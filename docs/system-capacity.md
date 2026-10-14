# Vận hành tải cộng tác

Phép đo và số liệu trước–sau nằm trong [báo cáo 100 người dùng](../../.kiro/reports/system-capacity/100-users-capacity.md). Kịch bản gồm 100 tài khoản riêng trên 20 project, đọc quyền mỗi2giây, lưu file và gửi chat mỗi10giây/người, đọc bổ sung mỗi5giây, các request đồng bộ phát sinh từ realtime và xuất PDF mỗi20giây. Đây là tải API/WebSocket qua loopback; không thay cho kiểm thử trình duyệt, proxy hoặc máy production.

## Cấu hình

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `DB_POOL_MAX` | `10` | Số connection tối đa của pool mỗi process; LISTEN dùng thêm1connection riêng. |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | Thời gian chờ lấy/mở connection; lỗi được trả về thay vì chờ vô hạn. |
| `COMPILE_WORKER_ENABLED` | `true` | Chấp nhận chính xác chuỗi `true`/`false`; khi tắt, yêu cầu tạo job mới trả503. |
| `COMPILE_MAX_OUTSTANDING_JOBS` | `32` | Tổng job đang chạy, đang chờ và slot đã giữ trước khi tạo row. |
| `COMPILE_TIMEOUT_MS` | `60000` | Deadline tiến trình native, tính cả khởi động; `.env.example` minh họa30000. |

Không tăng pool theo số người dùng. Quan sát thời gian lấy connection, số connection chờ và giới hạn của PostgreSQL; tính cả mọi instance/listener/công cụ vận hành trước khi chỉnh. Benchmark giữ pool10. `.env` thật không được đổi tự động.

## Hành vi sau tối ưu

- Realtime gom kiểm tra phiên trong một lượt xử lý, tối đa200kiểm tra/batch và1000kiểm tra chờ. Luôn đọc account, token bị thu hồi và quyền hiện tại từ DB; không cache kết quả quyền theo TTL. Chu kỳ kiểm tra2giây, deadline2,5giây và kiểm tra trước gửi vẫn giữ nguyên.
- `/access` đọc snapshot repeatable-read/read-only, không tạo collaboration state và không lấy khóa ghi project. Mutation tiếp tục dùng khóa và kiểm tra quyền để bảo vệ thu hồi/CAS.
- Các API dùng chung `loadAccessFacts` đọc account/project/member/grants/state bằng một SQL parameterized, có scope project/member và mốc hết hạn UTC rõ ràng. Quy tắc vai trò tiếp tục nằm trong domain.
- Bcrypt dùng native async cost10, giữ tương thích mật khẩu/hash bcryptjs cũ. Dependency native đã có trong package; cần cài dependencies đúng nền tảng triển khai, không sao chép node_modules từ Windows sang Linux.
- Native Typst chạy trong child process riêng. Timeout/shutdown cưỡng chế kết thúc process và chờ process thoát trước khi dọn workdir. Chỉ1native compile chạy tại một thời điểm; preview nhanh vẫn ở client.
- Admission dùng chung cho export và admin tạo artifact khi chưa có PDF. Yêu cầu đồng thời cùng project/entry dùng chung job; queue đầy trả429 `COMPILE_QUEUE_FULL`, worker dừng/tắt trả503 `COMPILE_UNAVAILABLE`. Response thành công vẫn là `{job}`. Khi overload, client hiển thị lỗi và người dùng có thể thử lại; không retry dồn dập.
- Queue chỉ giữ tối đa32job trong RAM; backlog bền vững được đọc theo batch. Job queued không hết hạn theo tuổi. Sau restart, job running bỏ dở quá2×timeout được đánh dấu thất bại; sweep5giây loại trừ job đang thuộc queue hiện tại. Shutdown giữ các job chưa chạy trong DB để lần khởi động sau phục hồi.

Thiết kế queue/ticket/rate limit hiện dành cho **một backend instance**. Trước khi chạy nhiều process/replica cần cơ chế nhận job độc quyền trong DB hoặc queue dùng chung, ticket dùng chung hoặc định tuyến phù hợp, và bài test đa instance. Không dùng kết quả local để suy ra100exportPDF đồng thời hoặc100lần import ZIP50MB.

## Chạy lại bài đo

Từ thư mục backend, dùng `DATABASE_URL` tới PostgreSQL kiểm thử có quyền CREATE/DROP schema. Runner tạo schema `codex_load_<16hex>`, áp dụng baseline fixture và migration additive chia sẻ trong schema đó, tạo artifact trong thư mục tạm riêng rồi dọn đúng phạm vi. Không chạy migration vào schema ứng dụng.

```powershell
npx tsx scripts/load-system-capacity.ts --label after --seconds 60
npx tsx scripts/load-system-capacity.ts --label sustain --seconds 300
```

Runner khởi chạy server và client thành hai process, đăng ký các module thật với Prisma schema riêng. Nó không gọi nguyên `buildApp()` vì plugin DB hiện mặc định schema public. Có hỗ trợ `--users`, `--projects`, `--file-bytes`, `--pool-max`, `--pool-timeout-ms`; giữ các giá trị giống nhau khi so sánh và không chạy build/test CPU nặng cùng lúc. Report JSON ghi hardware, fingerprint source, offered/skipped work, HTTPpercentiles/status, WSdelivery, SQL/pool, eventloop, CPU/RSS server, PDF và thu hồi quyền. `completed` chỉ nói runner đã đi hết; dùng thêm `acceptance.passed` và từng check. Lỗi bootstrap cũng làm acceptance fail.

RSS/CPU server sau tối ưu không bao gồm child compiler, PostgreSQL và driver tải; cần quan sát tổng host khi sizing production. Bài đo chưa bao gồm network Internet/TLS, render/preview trên100browser, thư viện ngoài, filebinary lớn, ZIPimport/export đồng thời, DB chứa lịch sử lớn hoặc soak nhiều giờ. Upload/ZIP và tăng trưởng event log cần benchmark riêng trước khi mở các tải đó ở quy mô lớn.
