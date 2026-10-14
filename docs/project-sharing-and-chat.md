# Chia sẻ project và thảo luận — triển khai bản đầu

Cập nhật 2026-10-13. Source và tối ưu realtime đã triển khai. Migration additive đã áp dụng lên database phát triển local sau backup và kiểm tra pending history để sửa lỗi project500 do thiếu revision. Theo yêu cầu hiển thị nút chia sẻ, hai feature flags đã được bật trên local và hai dịch vụ dev đã khởi động lại; chưa triển khai staging/production. [Báo cáo sửa schema local](../../.kiro/reports/backend-frontend-integration/project-schema-repair-2026-10-13.md), [báo cáo bật tính năng local](../../.kiro/reports/backend-frontend-integration/project-sharing-local-activation-2026-10-13.md).

## Hành vi

Chủ project tạo link với ba mức: `viewer` (xem), `commenter` (xem và nhận xét), `editor` (sửa project). Form mặc định xem và hết hạn sau7ngày; chọn **Không hết hạn** để tạo link không giới hạn thời gian. Cả ba được chat; người nhận phải đăng nhập và bấm nhận quyền. Chỉ chủ quản lý link, thành viên và xóa project. Editor được sửa source/settings chung, compile, xuất ZIP và tạo bản sao, không được lấy cấu hình tích hợp riêng của chủ.

Một thành viên có thể nhận nhiều link: quyền cao nhất của các grant còn hiệu lực được dùng, trừ khi chủ đặt override. Block/leave loại bỏ grant; unblock không tự khôi phục quyền cũ. Rotate vô hiệu hóa token cũ nhưng giữ grant đã nhận; revoke vô hiệu hóa link và quyền từ link đó. Quyền quản trị giám sát hiện có không tự cho phép chat/quản lý chia sẻ.

URL có dạng `/share/<linkId>#token=<secret>`. Landing xóa fragment khỏi thanh địa chỉ, giữ token tạm trong sessionStorage của tab tối đa 10 phút để đi qua đăng nhập/đổi mật khẩu, rồi xóa sau khi nhận quyền. Backend chỉ lưu SHA-256 của token; raw token chỉ trả khi tạo/rotate. Không thêm token vào query, log hoặc danh sách link.

Chat, nhận xét và event được lưu trong PostgreSQL. Tin nhắn có khóa idempotency UUID và sequence dạng chuỗi số; xóa dùng tombstone. Nhận xét hỗ trợ project/file/đoạn source với offset UTF-16, fileId và revision; đổi source đánh dấu neo cũ, xóa file giữ nhận xét. Xóa cuộc nhận xét xóa nội dung và quote khỏi các DTO về sau.

## Điều kiện lưu bắt buộc

HTTP update/rename/delete file cần `fileId` và `baseRevision`; delete truyền chúng trong query. Update project/settings cần `baseRevision`. Thiếu điều kiện trả 428; phiên bản sai trả 409. Điều kiện này có hiệu lực cả khi flag chia sẻ tắt. Các writer nội bộ (bibliography/import/upload) cũng xác minh quyền trong transaction và dùng CAS khi cập nhật source.

Frontend giữ bản nháp theo tài khoản/project/path, kèm fileId, revision và nội dung gốc. Xung đột dừng tự lưu, giữ bản nháp để đối chiếu, hợp nhất hoặc tải xuống. Không nhập tự động bản nháp cũ không xác định tài khoản/phiên bản. Đây là đồng bộ sau khi lưu; không có CRDT từng phím.

## Cấu hình và thứ tự rollout

Backend mới cần schema mới ngay cả khi `PROJECT_SHARING_ENABLED=false`. Trước chạy backend ở môi trường khác, dùng `npx prisma migrate status` trong `backend` và review migration pending. Nếu chỉ có migration additive đã kiểm tra, sao lưu rồi áp dụng bằng `npx prisma migrate deploy`; kiểm tra status lại trước khởi động. Không dùng `migrate reset`/`db push` để xử lý lỗi thiếu cột. Lỗi `P2022: Project.metadataRevision does not exist` làm GET /projects500 ở mọi vai trò; đây là schema chưa đồng bộ, không sửa bằng nới quyền admin/student/teacher.

1. Kiểm tra migration history/schema thực, backup và diff ứng dụng trên môi trường mục tiêu. Có migration lịch sử `20260706144830_drop_unused_project_tables` chứa DROP; không chạy toàn bộ migration pending một cách mặc định. Nếu môi trường còn bảng collaboration cũ, lập mapping/backfill riêng trước khi quyết định migration nào áp dụng.
2. Review và áp dụng migration additive `prisma/migrations/20261003000000_project_sharing_and_chat/migration.sql` trên schema mục tiêu đã xác minh. Nó thêm revisions, bảng/grant/event/constraints/index và backfill collaboration state cho project cũ. Không dùng `db push` để thay migration history.
3. Generate client bằng `npx prisma generate --generator client`, build backend/frontend và triển khai phối hợp hai bản có CAS. Client cũ sẽ nhận 428; không bật shared editing trước khi frontend mới gửi đủ điều kiện.
4. Giữ `PROJECT_SHARING_ENABLED=false` và `VITE_PROJECT_SHARING_ENABLED=false` trong bước chuẩn bị. Migration vẫn bắt buộc trước khi chạy backend mới: các repository đọc revision/state ngay cả khi flag tắt.
5. Thiết lập backend `PROJECT_REALTIME_ORIGINS` bằng danh sách origin frontend đầy đủ, phân cách dấu phẩy, ví dụ `https://editor.example.org`. Origin phải khớp chính xác; không dùng wildcard. Frontend `VITE_API_BASE_URL` phải gồm `/api/v1`.
6. Sau smoke test và browser QA, bật `PROJECT_SHARING_ENABLED=true`; build frontend với `VITE_PROJECT_SHARING_ENABLED=true`. Vite env được nhúng lúc build. Flag backend đăng ký sharing, discussion và realtime cùng nhau; không có flag discussion/realtime riêng trong bản này.

Các file `.env.example` vẫn mặc định tắt để môi trường mới hoàn tất migration trước khi bật. Cấu hình local đã kích hoạt ngày 2026-10-13:

```dotenv
# backend/.env
PROJECT_SHARING_ENABLED=true
PROJECT_REALTIME_ORIGINS=http://localhost:5173

# Frontendtluscholareditor/.env.local
VITE_PROJECT_SHARING_ENABLED=true
```

Hai file local được Git ignore; mọi credential khác được giữ nguyên. Backend cần restart khi đổi env; frontend Vite cần restart dev server hoặc build lại bản deploy. Chỉ bật frontend sẽ hiện UI nhưng API chưa sẵn sàng; chỉ bật backend sẽ không hiện nút. Mở lại project sau khi tải lại trang; nếu phiên đăng nhập đã hết hạn, đăng nhập lại.

Chủ project thấy **Chia sẻ** và **Thảo luận** ở thanh trên, trước **Xuất PDF**. Trong Chia sẻ, chọn quyền rồi tạo và sao chép link. Trong Thảo luận có hai tab **Tin nhắn** và **Nhận xét**. Người nhận link cần đăng nhập và nhận quyền; viewer vẫn được chat nhưng không được tạo nhận xét hay sửa source. Backend luôn kiểm tra quyền; admin giám sát project của người khác không tự có quyền quản lý link.

Sinh viên và giảng viên mở danh sách đã nhận qua mục **Được chia sẻ với tôi** cạnh **Project của tôi** trên dashboard. Admin có mục cùng tên trong menu, tại `/admin/shared`; đây là các project đã nhận lời mời, tách khỏi danh sách giám sát `/admin/projects`. Các lối điều hướng chia sẻ chỉ hiện khi cờ frontend bật.

## Realtime và giới hạn

Single instance. HTTP Bearer cấp ticket one-use tối đa 30 giây, lưu hash trong RAM (tối đa 5.000, 10 ticket pending/account). WS URL chỉ có projectId. Frame đầu `{type:"authenticate",ticket,since:"0"}`; server gửi `ready`, sau đó `events` chứa cùng envelope với REST recovery. Mutation đi HTTP. Ticket sai project bị tiêu thụ và không thể dùng lại.

Transport đọc event log đã commit và được đánh thức bằng PostgreSQL LISTEN/NOTIFY. `appendProjectEvent` ghi hint projectId trong cùng transaction; chỉ commit mới phát hint, rollback không phát. Channel `project_events_<md5(current_schema())>` cách ly schema; hint không chứa nội dung/token. Đây là ngữ nghĩa giao dịch của [PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html). Adapter có một kết nối session riêng, dùng cùng `DATABASE_URL`, tự reconnect từ 250 ms tới 10 giây có jitter. Database URL phải hỗ trợ kết nối session ổn định cho LISTEN (kết nối trực tiếp hoặc session pooling); transaction pooling không phù hợp. Không thêm biến môi trường hay migration cho tối ưu này.

WS gom wake theo project trong 25 ms, tối đa 8 lượt đọc replay đồng thời trên instance, mỗi trang 100 event và nhường event loop giữa các trang. Backlog được đọc tiếp ngay, không đợi timer. Replay chạy repeatable-read/read-only, không giữ khóa ghi project; hydrate messages/replies/threads theo batch, không N+1 theo số event. Không đọc source file khi hydrate neo nhận xét. Cursor đã bắt kịp bỏ qua scan event. Không có dispatcher `dispatchedAt` riêng.

Poll dự phòng 10 giây vẫn chạy để phục hồi hint bị mất, listener reconnect hoặc writer phiên bản cũ; khi đăng ký WS không cấp wake adapter, fallback là 2 giây. Log cảnh báo `Project event notifications unavailable` báo hiệu đường wake đang dùng fallback. Độ trễ lúc listener hỏng có thể tới một chu kỳ fallback cộng thời gian xử lý. Không dùng notification làm dữ liệu hay bằng chứng cấp quyền: backend luôn kiểm tra account/JWT jti/quyền sau đọc và trước gửi, đồng thời mỗi 2 giây với deadline fail-closed 2,5 giây độc lập hàng đợi replay. Thu hồi dưới 5 giây vẫn qua fixture. Read-state chỉ trả cho chính user đó; replay hydrate trạng thái entity hiện tại/tombstone.

Frontend áp dụng một trang event theo batch; files/metadata/settings mỗi resource chỉ refresh một lần trong trang. Cursor chỉ tiến khi cả batch thành công. Read/unread gom trong cửa sổ cố định 100 ms, một request chạy tại một thời điểm, giữ sequence mới nhất. Quyền không đổi không tạo Zustand state mới. Draft/CAS/local typing vẫn giữ nguyên.

Giới hạn: 200 socket/instance, 5/account, frame client 2 KiB, timeout auth 5 giây, buffer 1 MiB, ping 30 giây. Ticket map/rate limits thuộc process. Sharing 90 request/phút/account; discussion GET 300 và mutation 120/phút/account. Tối đa 20 link chưa revoke/project; page tối đa 100, riêng REST events tối đa 200 (WS page100). Body chat/comment tối đa 4.000 ký tự, quote 2.000. Đã đo tải local 100 người/20 project trong 5 phút với các giới hạn này; chưa xác định trần capacity hoặc kiểm chứng production.

Chưa có retention/cleanup event hoặc API 410 khi cursor quá cũ. Theo dõi tăng trưởng event table, notification queue (`pg_notification_queue_usage()`), cảnh báo listener và số kết nối DB (thêm 1 session/instance). Khi scale nhiều replicas, PostgreSQL có thể đánh thức nhiều listener nhưng ticket/rate limits vẫn thuộc process; cần thiết kế chúng và kiểm thử fanout/load trước khi triển khai nhiều instance. Kiểm tra quyền từng socket mỗi 2 giây vẫn là chi phí cần đo ở tải lớn.

Reverse proxy cần HTTPS/WSS, Upgrade/Connection và timeout phù hợp heartbeat. Chưa xác minh proxy đang triển khai. Graceful shutdown đóng sockets; client lấy ticket mới và REST replay khi reconnect.

## Rollback

Tắt flag ngừng endpoint nhận link, discussion và WS sau restart. **Flag không xóa grant và không tắt resolver của các API đọc/ghi project**; không dùng nó như công cụ thu hồi quyền. Nếu cần cô lập shared access, revoke link/block thành viên khi endpoint quản lý còn hoạt động rồi mới tắt flag, hoặc triển khai kill switch resolver riêng đã được kiểm thử.

Giữ bảng, grant, chat, nhận xét, revision và IndexedDB. Không quay về backend bỏ CAS trong khi còn shared access. Không chạy down migration/drop collaboration để rollback ứng dụng. Không sửa migration lịch sử.

## Xác minh

OpenAPI cập nhật 2026-10-14: `/docs` và `/docs/json` có 28 operations dưới tags `project-sharing`/`project-discussion`, gồm request/response/status/security và capability descriptions. DTO dùng chung với runtime nhưng Swagger metadata không thêm serializer/validator vào routes. Integration fixture kiểm tra 77 HTTP responses và đủ 28 operations; xem [báo cáo contract](../../.kiro/reports/backend-frontend-integration/project-collaboration-openapi-2026-10-14.md). Các API project/file/settings CAS hiện hữu ngoài phạm vi này cần đối chiếu riêng.

`npm run test:integration:collaboration` tạo schema ngẫu nhiên `codex_collab_<16 hex>`, dựng baseline owner-only, áp dụng riêng migration mới, kiểm thử HTTP/DB/WS rồi drop đúng schema đó trong finally. Cần DATABASE_URL đến PostgreSQL test và quyền CREATE/DROP schema. Không dùng runner này thay migration rehearsal của toàn bộ lịch sử deployment.

Kết quả và checklist còn lại: [báo cáo tích hợp](../../.kiro/reports/backend-frontend-integration/project-sharing-and-chat-integration-status.md), [tasks](../../.kiro/specs/project-sharing-and-chat/tasks.md). Chưa có browser nhiều tài khoản, screen reader/mobile, load/EXPLAIN fixture lớn, proxy restart hoặc rollout trên DB thật.

Cập nhật capacity 2026-10-08: [báo cáo 100 người](../../.kiro/reports/system-capacity/100-users-capacity.md) xác nhận 30.004/30.004 lượt phát realtime trong 5 phút, p95 114 ms và không lỗi ngoài dự kiến. Kiểm tra session theo batch, quyền dùng chung bằng một SQL và `/access` read-only; không cache quyền. Native compile được tách process với queue hữu hạn. Xem [runbook cấu hình](system-capacity.md) và giới hạn phạm vi phép đo.

Tối ưu 2026-10-04: `npm run test:unit:discussion` 13/13; integration 22/22; frontend 348/348, build hai phía pass. Fixture PostgreSQL local: 20 và 100 event hỗn hợp cùng 13 SQL queries; 3 native sockets, 5 mẫu commit-to-receive tối đa 69,1 ms, burst 125 event 99,6 ms/6 lượt đọc trang. Đây là phép đo local sau Promise commit hoàn tất, không bao gồm render trình duyệt hoặc p95 tải staging. Unit transport với 20 socket/250 event kiểm chứng hàng đợi tối đa 8 lượt đồng thời. `npm run typecheck` frontend vẫn có lỗi baseline ngoài thay đổi realtime.
