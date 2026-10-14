# Auth admission và cấu hình trước staging

Runtime đã nối `authRoutes` với queue hữu hạn cho **login và change-password**. Giữ nguyên DTO, JWT/refresh rotation, error envelope, giới hạn body và khả năng xác minh mật khẩu cũ. Không migration/schema hoặc dependency mới. Refresh/logout không dùng queue này.

| Biến | Mặc định | Ý nghĩa |
|---|---:|---|
| `AUTH_PASSWORD_CONCURRENCY` |4| Tác vụ mật khẩu đang chạy mỗi process, phạm vi1..32 |
| `AUTH_PASSWORD_MAX_OUTSTANDING` |128| Tổng running+queued mỗi process, <=1024 và >=concurrency |
| `AUTH_PASSWORD_QUEUE_WAIT_MS` |5000| Chờ tối đa trước khi bắt đầu, phạm vi1..30000ms |
| `AUTH_LOGIN_IP_PER_MINUTE` |12000| Cửa sổ IP trước parse JSON, phạm vi1..1.000.000 |
| `AUTH_LOGIN_PAIR_PER_MINUTE` |10| Cửa sổ cặp email chuẩn hoá/IP sau validation |
| `AUTH_CHANGE_PASSWORD_PER_MINUTE` |5| Cửa sổ account sau Bearer verification |
| `TRUST_PROXY_CIDRS` |rỗng| Không tin forwarded IP; khi có ingress mới đặt allowlist literal IP/CIDR |

Mẫu đã có ở `backend/.env.example` và `deploy/.env.shared-state.example`. Giới hạn4 là điểm khởi đầu, chưa phải sizing production. Native bcrypt dùng thread pool của process; cân đối CPU/libuv với filesystem và số replica. Tổng work đang chạy bằng số process × concurrency; không nhân số process/connection pools chỉ dựa vào10k người kết nối. Khi hết slot hoặc queue timeout, trả503 `AUTH_BUSY`, `Retry-After: 1`. 429 `RATE_LIMITED` dùng thời gian TTL còn lại. Lỗi store trả503 `RATE_LIMIT_UNAVAILABLE`. Frontend hiện nhận các mã này qua `ApiError`; không tự gửi lại login/change-password POST và không logout vì429/503. Người dùng có thể thử lại sau.

Tác vụ đang chạy giữ slot cho tới khi Promise settle, kể cả peer rời đi hoặc shutdown. Queue timeout không ngắt một đổi mật khẩu đã chạy rồi trả lỗi gây hiểu nhầm. Peer disconnect loại task còn chờ. `preClose` đóng queue và từ chối việc mới; hard shutdown deadline của process vẫn là40s mặc định. DB/network deadline cần được bảo đảm ở hạ tầng; admission không tự huỷ Prisma query đang chạy.

Change-password kiểm tra Bearer trước quota và kiểm tra lại khi ra khỏi queue. Nếu token bị revoke/expire hoặc account disabled trong thời gian chờ, route trả lỗi auth hiện có trước khi gọi use case đổi mật khẩu. Kiểm tra này sử dụng fresh primary session reader; login tự đọc user trong slot được cấp. Bộ test có tình huống revoke khi request đang chờ.

Quota IP12000/min là trần rộng cho NAT của trường, cặp email/IP mới dùng hạn mức nhỏ. Cần đo phân bố NAT thực tế trước điều chỉnh. Đây không phải lớp chống DDoS tại biên; request body có giới hạn1MiB hiện hữu. Request malformed vẫn tiêu thụ quota IP, nhưng không tới DB/bcrypt. IP khác nhau không chia cửa sổ cặp email; hệ thống hiện chưa có biện pháp chống credential stuffing phân tán ngoài scope này. Local store chỉ trong process; Redis mode dùng chung counters và yêu cầu policy đồng nhất giữa các instance. Redis restart có thể reset quota; không tự fallback sang local khi Redis lỗi.

Proxy: chỉ cấu hình địa chỉ ingress thật, ví dụ trên lab có Nginx duy nhất ở loopback mới dùng `127.0.0.1/32,::1/128`. Không dùng ví dụ đó cho Docker nếu peer thực khác; không trust toàn subnet khi container không tin cậy ở chung mạng. Chặn truy cập trực tiếp origin và xác minh chuỗi proxy. Parser từ chối true/hop-count/hostname và /0; allowlist quá rộng vẫn là lỗi vận hành. Nginx hiện append địa chỉ peer vào X-Forwarded-For; Fastify duyệt từ peer gần nhất và dừng ở hop không tin cậy. Tham chiếu [Fastify trustProxy](https://fastify.dev/docs/latest/Reference/Server/#trustproxy).

Metrics khi bật metrics plugin:

- `tlu_auth_password_work{state="running|queued"}` và counters admitted/rejected/expired/cancelled/completed, không có user/IP/email label.
- `tlu_auth_password_duration_seconds{phase="queue|execution"}`: queue wait chỉ cho task đã start; execution chỉ cho task đã settle (bao gồm lỗi). Đọc cùng expiry/rejection counters để không che mất yêu cầu bị từ chối. Đây là thời gian toàn use case gồm DB/token work, không chỉ bcrypt.
- Khởi điểm alert: queue duy trì >80% phần chờ trong60s, expiry/rejection >1% trong5min hoặc loginp95 vượt SLO riêng đã chốt. Steady benchmark bất kỳ503/429 ngoài quota dự kiến đều fail; không coi overload response là capacity đạt.

Verification chuẩn bị: `npm run test:unit:auth`, `npm run test:unit:platform`, build backend/frontend. Tests gồm FIFO/capacity, timer chậm, disconnect, shutdown, native bcrypt/password dài, error contract, giả mạo XFF và quota qua hai app dùng chung local store. Đây chưa phải Redis proof. Tiếp theo chạy burst100→500→1000 trên staging, giữ số người/NAT định trước; đo completed/offered requests, queue/execution, pool wait, event loop, CPU và lỗi. Sau đó mới điều chỉnh giới hạn rồi chạy profile10k. Giữ logout/refresh hoạt động khi login queue đầy trong bài failure.

Rollback: drain process, quay lại artifact trước hoặc điều chỉnh các biến hữu hạn rồi rolling restart theo connection budget. Không xoá dữ liệu, không bật trustProxy toàn bộ để chữa lỗi quota. Với multiple instances, thay quota đồng bộ; fixed-window hiện tại sẽ hết hạn tự nhiên, không FLUSH Redis.
