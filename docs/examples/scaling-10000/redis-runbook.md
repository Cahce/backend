# Redis shared-state: chuẩn bị trước staging

Người dùng xác nhận chưa có staging. Các file dưới đây được chuẩn bị để kiểm chứng; chưa triển khai Redis/Docker, chưa chạy Lua trên Redis thật và chưa công bố đạt 10k.

## Chế độ chạy

- Mặc định `SHARED_STATE_DRIVER=local`: một process, contract vé không đổi.
- `redis`: đã wire shared ticket, rate-limit và socket lease stores. Quota10 vé/account và5000 vé đang chờ dùng chung; TTL tối đa30s. Cấp/tiêu thụ dùng Lua atomic, chỉ hash của vé làm key, user quota dùng HMAC. Role/JTI/membership vẫn kiểm tra lại từ primary PostgreSQL.
- URL hỗ trợ `redis://` và `rediss://` tới một endpoint. Chưa có Sentinel discovery hoặc Redis Cluster client. Các instance phải dùng cùng namespace/key secret. Đổi secret phải drain các instance cũ và chờ hết TTL để tránh chia đôi quota.
- Redis lỗi trả HTTP503 `REALTIME_UNAVAILABLE`, `Retry-After: 1`; quota vé trả429 `REALTIME_BUSY`. Không fallback sang local. WS hiện giữ close4403 khi handshake không hoàn tất; frontend đã có reconnect/backoff và lấy vé mới.
- Client giới hạn256 lệnh đang chờ, deadline500ms, connect/auth deadline2s. Tắt offline replay; timeout hủy socket và các lệnh cùng connection, rồi reconnect có backoff/jitter. Lệnh timeout có thể đã chạy trên server: không gửi lại cùng thao tác consume.
- Rate-limit dùng fixed window60s theo account/scope: sharing90, discussionread300/write120, realtime-ticket60. 429 `RATE_LIMITED` có Retry-After theo TTL còn lại; 503 `RATE_LIMIT_UNAVAILABLE` khi Redis lỗi hoặc store đạt100.000 windowkeys. Denied không kéo dài TTL; key dùng HMAC, không raw identity. Local/Redis đều giữ giới hạn bộ nhớ; Redis prune tối đa512 expired entries khi mở window mới. Chưa có pre-bcrypt IP/login admission; request đã auth không gộp theo IP NAT.
- Socket lease: tối đa5/account, global10.000 mặc định, physical cap200/instance mặc định. `REALTIME_MAX_SOCKETS_PER_INSTANCE` có thể cấu hình1..2000, `REALTIME_MAX_SOCKETS_GLOBAL`1..100000, instance không được vượt global. Đây là admission ceiling, không phải kết quả benchmark. TTL lease15s, renew5s theo batch<=100, local expiry sweep500ms. Deadline monotonic chặn send/late renew sau hết hạn. Lỗi renew/lease lost đóng1013; full transport cap trả Upgrade503 + Retry-After1. Origin sai vẫn403. Close/drain release, crash được thu hồi theo TTL. Các instance phải dùng cùng global cap.
- Readiness yêu cầu primary và Redis; mất kết nối Redis làm readiness503 ngay, liveness vẫn200. Metrics bổ sung `tlu_redis_state` và counters attempts/completed/errors/timeouts/rejected; không label theo key/URL/user.

## Cấu hình stack hiện tại

Giữ `docker-compose.yml` hiện có và thêm [override Redis](../../../../deploy/compose.redis.yml). Override vẫn chạy một backend; bổ sung readiness healthcheck và grace period45s. Redis không publish port, chỉ nằm trong mạng nội bộ, có ACL, cap256MiB với `noeviction`, container512MiB. Đây là giá trị khởi điểm cho vé/counters/leases, chưa phải sizing10k. Service này không lưu bền state khi restart; BullMQ sau này cần Redis riêng với persistence và gate crash/recovery. Restart/failover có thể reset quota và lease state, nên HA gate phải kiểm tra hoặc bổ sung fencing trước chạy nhiều instance.

Từ `backend/`, sinh credential mới vào thư mục ngẫu nhiên trong `tmp/` đang bị Git ignore:

```powershell
node scripts/prepare-redis-config.mjs tlu-stage
```

Lệnh chỉ in đường dẫn tới `users.acl` và `app.env`, không in secret. Mỗi lần chạy tạo thư mục mới, không ghi đè `.env`. ACL tắt default user; `health` không mật khẩu chỉ được PING; `realtime` dùng password hash, giới hạn command và ba key prefix `realtime-tickets`, `rate-limit`, `socket-leases`. ACL chỉ cho vé ở bản trước phải được cập nhật trước khi bật code mới. Không dùng health user cho backend.

Từ workspace root, đặt `REDIS_ACL_FILE` và `SHARED_STATE_ENV_FILE` thành đường dẫn tuyệt đối do generator trả về (chỉ đường dẫn, không phải nội dung secret), rồi kiểm tra:

```powershell
docker compose -f docker-compose.yml -f deploy/compose.redis.yml config --quiet
```

Không dùng `docker compose config` không có `--quiet` trong log chia sẻ vì output có thể chứa env secrets. Generator tạo file mode0600 trên Linux; Compose file-backed secrets có thể giữ quyền host. Override dùng init shell ngắn chạy root để copy ACL vào tmpfs riêng, đặt owner `redis`, rồi gọi [official entrypoint](https://github.com/redis/docker-library-redis/blob/master/docker-entrypoint.sh) để hạ quyền trước chạy Redis. Secret trên host vẫn private; không cần mở quyền đọc cho mọi người. `app.env` chỉ runtime backend nhận được, không copy vào image. Windows dùng ACL của tài khoản host; mode POSIX không thay thế NTFS permissions.

Trên cùng host Docker, URL mẫu generator dùng TCP private có ACL. Với nhiều host, dùng `rediss://`, CA tin cậy, firewall/network policy và endpoint TLS thích hợp; không mang cấu hình TCP này ra Internet. Pin digest image sau khi validate trên Linux. Tag mẫu `redis:8.2.10-alpine` đối chiếu [official image](https://hub.docker.com/_/redis).

## Kiểm thử Redis thật

Dùng lab riêng, không dùng production endpoint. Từ `backend/` trên máy đã có Docker:

```powershell
docker compose -p tlu-redis-capacity-test -f docs/examples/scaling-10000/compose.redis-test.yml up -d --wait
$env:TEST_REDIS_URL = 'redis://127.0.0.1:16379'
npm run test:integration:redis
docker compose -p tlu-redis-capacity-test -f docs/examples/scaling-10000/compose.redis-test.yml down
Remove-Item Env:TEST_REDIS_URL
```

Lab không có password, chỉ bind127.0.0.1 và không có volume bền. Không expose port ra host khác. Runner **không** đọc `.env` hoặc `REDIS_URL` ứng dụng; thiếu `TEST_REDIS_URL` thì fail rõ ràng. Hai client TCP độc lập dùng namespace ngẫu nhiên; cleanup chỉ SCAN/UNLINK namespace đó, không FLUSH. Test account/global quota, 40 lần consume đồng thời, sai project đốt vé, policy sau consume, collision, expiry và mất issuing client. Đã thêm rate-window concurrency/TTL và socket quota/renew/owner release/expiry; lease ngắn không được làm expire index giữ lease dài. Policy ở runner này là fixture; primary policy thật được kiểm tra riêng bằng `test:integration:collaboration`.

Gate tiếp theo phải kiểm tra hai **process/API thật**, ACL/TLS, kill process, Redis outage/reconnect, failover/restore và reconnect storm. Atomic Lua trên một Redis primary không chứng minh one-use sau failover: replication bất đồng bộ có thể phục hồi vé đã tiêu thụ. Cần durable consume ledger/fencing hoặc chiến lược failover đã kiểm chứng trước HA. Không bật nhiều API cho tới khi shared socket/rate quota, files và durable compile hoàn tất.

Nguyên tắc queue/reconnect đối chiếu [Node-Redis production usage](https://redis.io/docs/latest/develop/clients/nodejs/produsage/); API cụ thể đối chiếu typings/source của `@redis/client`6.3.0 đang cài.
