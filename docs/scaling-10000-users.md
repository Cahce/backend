# Kế hoạch tối ưu 10.000 người dùng

Ngày 2026-10-08. **Đang triển khai, chưa chứng minh tải10k.** Đợt P0 đã có auth batch đọc primary, direct DB URL, health/drain và Nginx WebSocket. Redis/PgBouncer/BullMQ/cluster và các đoạn cấu hình đích bên dưới chưa được kích hoạt. Tiến độ và bằng chứng: [báo cáo triển khai](../../.kiro/reports/system-capacity/10000-users-implementation.md).

- [Requirements](../../.kiro/specs/system-capacity-10000-users/requirements.md): ba profile tải, SLO, backward compatibility.
- [Design](../../.kiro/specs/system-capacity-10000-users/design.md): phân tích đủ database/application/cache/infrastructure/async/monitoring/load, code wiring, connection budget, trade-offs và rollout.
- [Tasks](../../.kiro/specs/system-capacity-10000-users/tasks.md): thứ tự PR, affected files, acceptance và kiểm chứng.
- [Baseline100](../../.kiro/reports/system-capacity/100-users-capacity.md): số đo lịch sử; không coi là source hiện tại hoặc benchmark10k.
- [Realtime memory/recovery](../../.kiro/reports/system-capacity/realtime-memory-and-recovery-2026-10-15.md): diagnostic mới100users/20projects300s,30.004deliveries/15PDF, memorytimeline và giới hạn.
- [Frontend read-state backpressure](../../.kiro/reports/system-capacity/chat-read-sync-backpressure-2026-10-15.md): cadence2s+jitter, latest intent và bounded retry/Retry-After. Synthetic600events/60s tạo30requests trong window,31sau drain; chưa phải browser hot-room benchmark và không thay các raw baseline trước.

## Local memory diagnostic

`node --import tsx scripts/load-system-capacity.ts --label realtime-memory-diagnostic-300s --users 100 --projects 20 --seconds 300 --file-bytes 16384 --pool-max 10 --pool-timeout-ms 5000 --instrumentation true` chạy actual module routes/nativeWS/Typst trong scratch schema và temp storage riêng; không phải fullbuildApp/proxy/Redis/pooler/staging. Không chạy build/test cùng benchmark; nguồn đo/guard/cleanup nằm trong report mới.

Worker sample mỗi giây thêm HeapTotal/External/ArrayBuffer/V8physical/malloced/heaplimit bên cạnh RSS/HeapUsed. External đã gồmArrayBuffer; V8malloced không phải toànnative, peak tính từ lúc process chạy, finalstats sau percentile/metrics khác mẫu định kỳ cuối. Exact pool-wait samplearray và instrumentation cũng giữ memory trong process. Không forceGC/heapdump hoặc suy leak từ một endpoint RSS; phân tích từng cửa sổ, loại drain khỏi offeredload, rồi mới làm retained-object/native allocation/soak dài. Đây là diagnostics additive, không đổi production metric/endpoint hoặc cache authorization.

## Những điểm thay đổi ưu tiên

1. Pool hiện10/process và rate limit sharing/chat đã có. Đo query/pool wait trước tăng connection.
2. Frontend Nginx đã bổ sung Upgrade/Connection forwarding và health routing, được smoke bằng Nginx thật. Còn gate Docker/Linux/TLS.
3. Giảm `/access` poll2s và refresh fanout có khả năng giảm tải lớn hơn cache catalogue. Chỉ poll này ở10k đã là5000GET/s; sửa client phải giữ server-authoritative revoke.
4. Ticket/rate/socket đã có adapter Redis opt-in (còn gate Redis thật/HA); defaultlocal vẫn giữ. Auth HTTP đã bỏ cached allow60s, đọc user/JTI primary theo batch. Local compile recovery và local disk vẫn phải sửa trước PM2/replicas.
5. PgBouncer transaction pooling cần direct connection cho LISTEN/migration. Read replicas chỉ phục vụ dữ liệu chấp nhận stale.
6. Docker/Compose/Nginx đã có; mở rộng cấu hình đang dùng, giữ font/nativeTypst và migration workflow. Production compose PG16/Node22 khác benchmark local PG18/Node24.

## Cấu hình/code tham khảo

Config **đã được wire** trong đợt P0:

| Biến | Mặc định | Hành vi |
|---|---|---|
| `DB_POOL_MODE` | `direct` | `transaction` bắt buộc khai báo direct URL; không tự cài pooler |
| `DIRECT_DATABASE_URL` | trống, fallback `DATABASE_URL` | LISTEN và Prisma CLI; khi dùng PgBouncer trỏ tới primary/session endpoint |
| `DB_POOL_MAX` | 10 | Giới hạn pool/instance hiện có; vẫn phải nhân số process và rolling surge |
| `SHUTDOWN_DRAIN_MS` | 3000 | Thời gian readiness503 trước đóng server |
| `SHUTDOWN_TIMEOUT_MS` | 40000 | Deadline toàn shutdown; bắt buộc lớn hơn drain |
| `METRICS_ENABLED` | false | Bật registry và `GET /metrics` có bảo vệ |
| `METRICS_TOKEN` | trống | Khi bật phải có token riêng >=32ký tự; cung cấp qua secret, không dùng JWT_SECRET |
| `SHARED_STATE_DRIVER` | local | `redis` bật shared ticket store, không fallback local khi dependency lỗi |
| `REDIS_URL` / `REDIS_KEY_SECRET` | trống | Bắt buộc khi bật Redis; key secret >=32 ký tự, đồng nhất giữa instance |
| `REDIS_NAMESPACE` | tlu-local | Prefix môi trường, 1–48 ký tự chữ/số/gạch ngang/gạch dưới |
| `REDIS_COMMAND_TIMEOUT_MS` / `REDIS_CONNECT_TIMEOUT_MS` | 500 / 2000 | Deadline command/handshake; timeout đóng socket và reconnect |
| `REDIS_MAX_PENDING` | 256 | Pending command hữu hạn; offline queue bị tắt |
| `REALTIME_MAX_SOCKETS_PER_INSTANCE` | 200 | Physical socket admission/instance (1..2000), tăng sau benchmark |
| `REALTIME_MAX_SOCKETS_GLOBAL` | 10000 | Shared authenticated lease cap (1..100000), phải đồng nhất toàn cụm |

`GET /health` giữ contract cũ. `/health/live` trả200 không query DB; `/health/ready` trả200/503 theo probe primary chạy nền mỗi1s, timeout500ms, không có query song song do scrape dồn. Khi drain, request nghiệp vụ mới và WS Upgrade trả503 + Retry-After1. WS hiện hữu đóng1012, chờ tối đa2s rồi terminate. Nếu deadline shutdown vượt quá, process thoát1 để supervisor thay thế.

Auth overload/dependency lỗi trả503 `AUTH_UNAVAILABLE` + Retry-After1; inactive401 `ACCOUNT_INACTIVE`, revoked401 `TOKEN_REVOKED`, bắt đổi password403 `PASSWORD_CHANGE_REQUIRED`. Login/refresh/me DTO giữ nguyên. `/auth/me`, `/change-password`, `/logout` vẫn dùng được khi chỉ cần đổi password. Frontend thử refresh ởTOKEN_EXPIRED trước khi logout; không thêm generic write retry ở503 và local draft tiếp tục do editor giữ. Riêng read-state GET/monotonic PUT có bounded retry3/backoff/Retry-After như report trên; mutation khác giữ chính sách hiện có. Thay đổi role/flag có hiệu lực trên request mới; client đang mở trang có thể cần reload/login lại để cập nhật điều hướng.

- [pgbouncer.ini](examples/scaling-10000/pgbouncer.ini): transaction pooling, prepared statement tracking, TLS và budget.
- [nginx.conf](examples/scaling-10000/nginx.conf): LB2upstreams và WS. Đây là full standalone config; không copy cả file vào frontend `conf.d` vì file đó nằm trong http scope.
- [RateLimit.lua](examples/scaling-10000/RateLimit.lua): atomic count + TTL, trả remaining/retry ms. Infra Redis adapter gọi EVALSHA; map denied sang429 + `Retry-After=Math.ceil(ms/1000)`. Fixed window có burst ở ranh giới; token bucket nếu cần mượt hơn.
- [diagnostics.sql](examples/scaling-10000/diagnostics.sql): SELECT top query/connection/index; candidate index ở comment, chưa chạy DDL.
- [k6 script](../scripts/load/scaling-10000.js): nativeWS + REST theo route thật, refresh JWT và optional save/chat; HTTP benchmark constant arrival-rate.

Redis tickets đã có code trong `RealtimeTicketStore`, `LocalRealtimeTicketStore`, `RedisRealtimeTicketStore` và `plugins/SharedState.ts`. Lua HSET+TTL+ZSET reserve quota atomic; Lua take đọc/xóa vé và quota trong một thao tác. Adapter không đặt client Redis trong domain. **Chưa có Redis thật/staging để chạy integration**; runner chuẩn bị sẵn, không skip gate. Cấu hình Compose, generator secrets và lệnh kiểm tra: [Redis runbook](examples/scaling-10000/redis-runbook.md). HTTP thành công vẫn `{ ticket, expiresAt }`; primary policy vẫn được kiểm tra sau consume.

Code thực tế: [use case](../src/modules/project-discussion/application/RealtimeTickets.ts), [Redis adapter và Lua](../src/modules/project-discussion/infra/RedisRealtimeTicketStore.ts), [bounded connection](../src/shared/redis/BoundedRedisConnection.ts). Collision retry tối đa3 lần; validate token format trước khi hash. Lua dùng HGET+DEL để xoá cả ticket và quota atomic. Redis HA failover/restore vẫn cần gate riêng vì replication rollback có thể phục hồi ticket đã consume.

Shared rate-limit: `RequestRateLimit`/`RedisRateLimitStore` trong shared transport, Lua fixed-window atomic, sharing90/min/account, discussionread300/write120, ticket60. HMAC keys, tối đa100.000 windows; prune mỗi lần mở window mới có giới hạn512. Full store/dependency trả503, quota429 kèm Retry-After từ TTL thực; request bị từ chối không gia hạn window. Request đã auth không bị gom theo IP NAT. Local adapter cũng bounded, không eviction window còn sống. Pre-bcrypt login/IP admission và các endpoint khác còn triển khai tiếp.

Shared socket quota: port/adapter nằm trong discussion, manager `RealtimeSocketLeases` giữ lease15s, renew5s theo batch<=100 và sweep expiry500ms. Cap5/account, configurableglobal10k, transport200/instance. Kiểm tra deadline monotonic trước/sau truy vấn replay trước send; mất lease đóng1013, full transport Upgrade503+Retry-After1, Origin sai403. Late acquire sau disconnect được release; late renew không hồi sinh socket đã hết hạn. Crash được thu hồi theo TTL, còn Redis HA reset/failover phải có gate/fencing riêng.

Metrics mới: `tlu_rate_limit_{checks,admitted,limited,unavailable}_total`; `tlu_realtime_state{state="connections|authenticated|accounts|rooms|queued|activeReplays"}`. `authenticated` chỉ đếm socket OPEN có lease còn hiệu lực; `accounts` là số account trong từng process, **không** cộng rồi coi là số người duy nhất toàn cụm. Gate10k cần đối chiếu cả identity/delivery ledger. Không label theo account/project/key.

Metrics HTTP/pool/query/auth/runtime đã wire trong `plugins/Metrics.ts` và `shared/observability`; dùng `@prometheus-io/client`0.16.1, successor của prom-client, phù hợp Node22/24. Registry theo process, không có user/project/token/query parameters trong labels. Query metric chỉ operation enum và duration từ Prisma event; histogram acquire gồm thời gian chờ connection. `/metrics` chỉ dành mạng nội bộ, header `Authorization: Bearer <METRICS_TOKEN>`, không yêu cầu DB/JWT còn sống; authorized scrapes dùng chung snapshot tối đa1s. Nginx public hiện không proxy đường này. Scrape mỗi15s và bảo vệ đường nội bộ bằng network policy/TLS theo topology. Redis client state/counters đã có khi bật shared mode; chưa có Redis server memory/latency, native-childCPU, replica/queue/event lag metrics.

Các alert dùng đúng metric name hiện có: [Prometheus rules](examples/scaling-10000/prometheus-rules.yml). Chưa chạy Prometheus server/promtool ở đây; thresholds là khởi điểm để tune với staging. Các mã mẫu dưới đây chỉ minh hoạ việc mở rộng instrumentation:

```ts
import { monitorEventLoopDelay } from 'node:perf_hooks';
const delay = monitorEventLoopDelay({ resolution: 20 });
delay.enable();
const timer = setInterval(() => {
  eventLoopP99Seconds.set(delay.percentile(99) / 1e9);
  poolWaiting.set(pool.waitingCount);
  poolInUse.set(pool.totalCount - pool.idleCount);
  delay.reset();
}, 5000);
timer.unref();
// onClose: clearInterval(timer); delay.disable();
// Histograms theo route template, không req.url chứa project/token.
```

OpenTelemetry phải initialize trước imports app/pg; chọn instrumentation phù hợp Fastify5/Prisma7/Node target, OTLP exporter sang collector và sampling; không log SQL bind/source. [OpenTelemetry Node](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/).

PM2 alternative cho một VM, **chỉ sau P0 shared-state/worker/storage hoàn thành**:

```js
// ecosystem.config.cjs (đề xuất; chưa thêm vào root deploy)
module.exports = { apps: [{
  name: 'scholar-api', script: 'dist/index.js',
  exec_mode: 'cluster', instances: 2,
  kill_timeout: 45000,
  env: { NODE_ENV: 'production' },
}] };
```

Không set `COMPILE_WORKER_ENABLED=false` hiện tại để giả lập producer: hiện flag này chặn enqueue503. Cần queue driver/workerrole mới trước. Không dùng `instances:max` rồi quên nhân pool budget. Nếu Kubernetes thì một Node/container, không thêm PM2 bên trong.

Kubernetes fragment cho API **sau khi health/drain/shared-state đã được wire** (image/deployment/PVC/secrets phải được ops cung cấp):

```yaml
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxUnavailable: 0, maxSurge: 1 }
  template:
    spec:
      terminationGracePeriodSeconds: 45
      containers:
        - name: api
          image: REGISTRY/scholar-api:IMMUTABLE_BUILD_TAG
          command: ["node", "dist/index.js"]
          resources:
            requests: { cpu: "1", memory: "1Gi" }
            limits: { cpu: "2", memory: "2Gi" }
          startupProbe:
            httpGet: { path: /health/live, port: 3000 }
            periodSeconds: 2
            failureThreshold: 30
          readinessProbe:
            httpGet: { path: /health/ready, port: 3000 }
            periodSeconds: 3
            timeoutSeconds: 1
          livenessProbe:
            httpGet: { path: /health/live, port: 3000 }
            periodSeconds: 10
            timeoutSeconds: 1
```

Đây là fragment thiết kế, không phải manifest apply được. Bổ sung labels/selectors/service/config/secrets, RWX storage, securityContext, anti-affinity/PDB, network policy và signal drain; worker là Deployment riêng với grace90–120s. Không tự đổi DB major hay tăng replicas trên Compose hiện tại.

## Chạy script k6

Prerequisites: k6 trên load generator, staging cô lập, sharing flag bật và WS_ORIGIN đúng allowlist, fixture user có quyền tương ứng, TLS certificate hợp lệ. Script không tự seed, không reset dữ liệu và không gọi logout-all. Writes dùng file/tài khoản thử có thể bỏ đi; cleanup do fixture provisioner sở hữu sau khi lưu báo cáo.

Fixture là JSON array đặt **ngoài checkout**, không ghi token/password vào Git, k6 output hoặc shell history:

```json
[
  {
    "email": "<test-account-email>",
    "password": "<fixture-secret>",
    "projectId": "<existing-fixture-project-id>",
    "filePath": "load-vu-00001.typ",
    "since": "0"
  }
]
```

Mỗi VU một account duy nhất; nhóm5accounts/project cho scenario thường, mỗi writer một text file riêng. `since=0` cố ý đo replay lịch sử; steady new-connection test có thể provision đúng current watermark để tách backlog cost. Không dùng token1account cho10kVU vì giới hạn5socket/account.

PowerShell từ `backend/`, smoke50users với default poll2s, không mutation:

```powershell
$env:RUN_LOAD_TEST = '1'
$env:BASE_URL = 'https://capacity-staging.example.org'
$env:ALLOWED_ORIGIN = $env:BASE_URL
$env:WS_ORIGIN = 'https://capacity-staging.example.org'
$env:CREDENTIALS_FILE = 'D:/load-fixtures/accounts.json'
$env:PROFILE = 'ws'
$env:USERS = '50'
$env:RAMP_SECONDS = '10'
$env:HOLD_SECONDS = '60'
$env:ACTIVE_PERCENT = '0'
k6 run --summary-export D:/load-results/ws-50.json scripts/load/scaling-10000.js
```

Tạo thư mục kết quả trước. Target chỉ là hostname ví dụ, phải dùng staging đã chuẩn bị. Script yêu cầu origin trùng để giảm nhầm môi trường; đây không thay cho network isolation.

Sau khi các gate thấp hơn đạt, chỉnh từng bậc500/1000/2500/5000/10000. Ví dụ cấu hình target (chưa chạy):

```powershell
$env:CONFIRM_LARGE_LOAD = '1'
$env:USERS = '10000'
$env:RAMP_SECONDS = '300'
$env:HOLD_SECONDS = '1800'
$env:ACTIVE_PERCENT = '20'
$env:ALLOW_WRITES = '1'
$env:ACCESS_POLL_MS = '2000'
$env:SAVE_MS = '10000'
$env:CHAT_MS = '30000'
k6 run --summary-export D:/load-results/mixed-10000.json scripts/load/scaling-10000.js
```

10kVU được cấp từ đầu; socket mở rải đều trong RAMP rồi kết thúc theo deadline chung. HOLD là plateau **dự kiến**: nếu login/ticket/connect chậm, server activeWS không đạt target thì fail capacity dù VU count đủ. JWT refresh trước exp30s và reconnect theo cursor; không tăng JWT TTL production để test dài. Record account sessions mới, refresh token rotation và server connected count.

Endpoint benchmark open arrival-rate, mỗi iteration một operation; login/file bootstrap/refresh của VU được gắn tag riêng:

```powershell
$env:PROFILE = 'http'
$env:USERS = '100'
$env:RPS = '50'
$env:OP = 'access'
$env:HOLD_SECONDS = '300'
k6 run --summary-export D:/load-results/access-50rps.json scripts/load/scaling-10000.js
```

OP hỗ trợ `access`, `project`, `files`, `chat-history`, `templates`, `save`, `chat`, `compile`; writes cần ALLOW_WRITES1 và disposablefile. Không nhận arbitrary URL/HTTP body từ fixture. Dùng mỗi OP một run, tăng RPS cho đến khi gần SLO rồi xác định headroom. `compile` chỉ đo admission202, chưa chứng minh PDF đúng/hoàn thành. Auth cold start có trong báo cáo, plateau analysis bỏ warmup rõ ràng chứ không bỏ lỗi tuỳ ý.

`ACCOUNT_INTERVAL_MS` mặc định1000ms (compile11000ms) giữ khoảng cách giữa hai operation của cùng account vì k6 có thể tái sử dụng chỉ vài VU khi API nhanh. Pacing không nằm trong `api_duration`, nhưng chiếm VU; cần đủ `USERS > RPS × (interval + service_time)` với headroom. Không đặt RPS200/USERS100/interval1s rồi quy dropped iterations cho server. Set interval0 chỉ khi chủ ý đo rate limiting hoặc biết quota cho phép; theo dõi unique accounts thực sự hoạt động.

Sharding: k6 execution segments/cloud dùng `exec.vu.idInTest` toàn cục, USERS là target toàn test và dùng cùng fixture. Nếu chạy các process độc lập, mỗi process đặt USERS riêng và ACCOUNT_OFFSET không trùng (ví dụ4×2500:0,2500,5000,7500); start đồng bộ, merge time-series cùng cửa sổ, không cộng percentile trung bình. Account fixture cần >=OFFSET+USERS; tránh đồng thời HTTP/WS generators cùng user/file trừ scenario có chủ ý. [k6 execution IDs](https://grafana.com/docs/k6/latest/javascript-api/k6-execution/).

## Đọc kết quả và giới hạn script

- `api_unexpected_error`: bao gồm429/503 khi scenario steady đúng quota; không gọi overload response là capacity thành công.
- `api_duration{op:...}` tách từng endpoint. Threshold mặc địnhp95<300ms/p99<1s; read SLO200ms trong spec cần siết khi gate chính thức.
- `ws_authenticated`: phải có HTTP101 **và** frame ready. `ws_ready_sessions` là tổng session (có reconnect), **không phải concurrency**; dùng gauge serveractiveWS để chứng minh10k, cùng `ws_authenticated_ms` và run duration để đối chiếu occupancy.
- Cursor giữ decimal string, không ép Number. Regression được đếm; gap có thể hợp lệ do filtering, nên cursor monotonic không chứng minh không mất event.
- `own_chat_echo_ms` đo từ lúc VU gửi HTTP tới khi cùng VU thấy echo; `own_chat_echo_missing` giữ cả tin gửi thành công chưa thấy lúc kết thúc. Nó **chưa** là ledger tất cả recipients; G01 phải bổ sung fanout ledger, revoke/fault injection và artifact assertions trước signoff10k. Không dùng latency của message nhận được để che message mất.
- HTTP trong WS timer có thể chặn việc xử lý callback của chínhVU; đo skippedtimeractions và CPU generator. Có thể làm latency echo cao hơn latency server thực; đối chiếu server commit/send spans.
- Client active20% có save/chat/projectread; client idle chỉ pollaccess+WS. Không mô phỏng toàn bộ FE event-triggered filetree refresh hay render/WASM. Vì vậy chưa tương đương hotprofile100users cũ; dùng ACTIVE_PERCENT100 và extend workload rõ ràng khi muốn so cùngprofile.
- `ACCESS_POLL_MS=0` chỉ dùng isolate chi phíWS; client production hiện vẫn poll2s. Không báo kết quả poll0 thành capacity của app chưa sửa.
- Reconnect/refresh reset action timers; unexpected disconnect làm thresholdfail. Gate cần đủ event counts và expectedRPS ngoài successlatency. Script không tự soak/faultinject hay tự abort theo servermemory/DBdisk; orchestrator/operator phải theo dõi ngưỡng thiết kế.

## Verification của lượt lập kế hoạch và đợt P0

PgBouncer trước staging: [runbook và lệnh kiểm chứng](examples/scaling-10000/pgbouncer-runbook.md). Có cấu hình single-host opt-in, rollback direct, private secret generator, strict connection-budget checker và isolated integration lab. Static/unit QA đạt; Docker build/Compose CLI/pooler thật vẫn chưa chạy, P0-03 giữ mở. Cấu hình khai báo78/97 slots không phải bằng chứng10k.

Auth admission/config bổ sung: xem [runbook mật khẩu và proxy](examples/scaling-10000/auth-admission.md). Các giới hạn đã wire vào runtime; không yêu cầu staging để chuẩn bị file cấu hình, không tự bật Redis/proxy trust hoặc cluster. Acceptance auth/local được ghi riêng với gate Redis và tải10k.

- Đã đối chiếu Routes/Dto, ticket first-frame `authenticate`, HTTP202 compile, CASfileId/baseRevision, JWT refresh và decimal event cursor với source.
- `node --check scripts/load/scaling-10000.js`: pass (syntax; không giả lập runtime k6).
- Nginx portable1.30.5 đã chạy `-t` và smoke trên loopback với chính cấu hình frontend: HTTP, WS ready/Origin/heartbeat, health/drain và close1012. Chưa có Docker/Linux/TLS hoặc k6/PgBouncer/Redis staging. Chưa có số đo10k.
- Backend build và full unit suite đạt sau nâng Fastify5.12.5/ws8.22.0/fast-jwt6.3.4; PostgreSQL/nativeWS integration24/24 đạt. Frontend build đạt. Runtime P0 thay đổi; không có migration/schema mới hoặc sửa `.env` thật trong đợt này.
- Lệnh tái lập: `npm run test:unit`, `npm run test:integration:collaboration`, `npm run test:integration:proxy -- <path-to-nginx>`, `npx tsx scripts/load-system-capacity.ts --label scaling-regression --seconds 300`. Bài capacity chỉ tạo schema/file fixture tạm, kiểm tra và xoá đúng phạm vi sau test.
- Metrics: `npm run test:unit:platform`17/17, `npm run test:integration:metrics`2/2, build hai phía pass. So sánh với `--instrumentation false` và `--instrumentation true` trong hai run riêng60s; cả hai đạt, CPU chênh+3,40 điểm%core ở phép đo này. Snapshot chỉ thu cuối phase, chưa có periodic scraper; chi tiết trong report.
- Audit dependency vẫn chưa sạch; xem báo cáo triển khai. Không dùng `npm audit fix --force` vì có gợi ý hạ Prisma7 xuống6, trái mục tiêu giữ stack/compatibility.
