# Docker local release — 2026-10-16

Stack được build và chạy thực tế trên Docker Desktop Linux amd64: Node22/Fastify/Prisma, PostgreSQL18 và Vite/nginx. Cấu hình tracked ở [compose.yaml](../compose.yaml), [runbook](../deploy/README.md) và [env example](../deploy/.env.docker.example). Frontend nằm ở repo sibling `Frontendtluscholareditor`, nhánh `feat/polish-and-refinements`; backend dùng `feat/backend-refinements`.

## Dữ liệu và bảo mật

Theo lựa chọn của chủ hệ thống, database/storage hiện có được **copy** vào ba named volumes `tlu-scholar_postgres-data`, `tlu-scholar_storage`, `tlu-scholar_templates`. Database nguồn được dump bằng exported snapshot trong transaction repeatable-read/read-only. Restore vào database Docker mới, kiểm tra số hàng và fingerprint của đủ30bảng trước khi mở ứng dụng; migration nhận đủ17migrations và không còn pending.

Bản sao gồm42projects,741files,17users; storage960files và templates383files. Sau smoke, transaction chỉ đọc kiểm tra lại đủ30bảng nguồn và checksum1343files nguồn: không thay đổi so với snapshot/copy. Fixture tạo trong Docker được dọn bằng ID ngẫu nhiên riêng; counts và Project/File/Settings digests trở về baseline. Dump/env/transfer helpers nằm trong ignored local paths, không được commit.

Backend chạy uid1000; Linux Prisma được generate trong image, native Typst load được và có Times New Roman. Build assertion kiểm tra không có `.env`, `deploy/.env.docker`, `tmp`; runtime kiểm tra lại các đường dẫn này đều vắng mặt. Backend/frontend build contexts loại private env và backups. Cache riêng của lần build trước khi bổ sung nested-env exclusion đã được xóa theo đúng4record IDs, không prune cache hoặc volumes của project khác.

## Kiểm chứng runtime

Smoke chạy qua **http://127.0.0.1:8080**, từ16:01:32Z đến16:01:38Z ngày16/10:

- Database/backend/web healthy; migration exit0; nginx configuration hợp lệ. Chỉ web publish loopback8080.
- Health/live/readiness JSON200; SPA deep link200; haiWASM trả binary đúng magic/MIME; missingWASM404.
- Bốn tài khoản fixture login/me thành công, protected request thiếu token trả401.
- Chủ project tạo link viewer/commenter/editor; resolve/redeem và capabilities khớp từng mức.
- Viewer/commenter sửa file403; editor lưu revision1→2, stale revision409; tạo link bởi editor403; commenter đăng nhận xét201.
- WebSocket qua nginx nhận chat giữa các thành viên; duplicate message không tạo thêm; read-state đúng; Origin ngoài allowlist403.
- Thu hồi editor link đóng socket4403; đọc file và gửi chat sau thu hồi403.
- Native Linux Typst compile thành công; artifact PDF42973bytes được parse xác nhận2trang.
- Cleanup không còn fixture users/projects, xóa đúng2artifactfiles và xác nhận baseline.

Images local: `tlu-scholar-backend:20261016`, `tlu-scholar-frontend:20261016`. Chia sẻ/chat bật ở cả build frontend và backend. Shutdown grace60s bao trùm deadline app40s; Zotero capture có profile tùy chọn, chưa được smoke ở đợt này.

## Phạm vi

Frontend full suite gần nhất:62files/541tests passed; Docker build cả hai repo thành công. Smoke trên xác minh local container integration, không thay cho staging, distributed Redis/PgBouncer, soak hoặc10kCCU. Những báo cáo `.kiro` được dẫn ở tài liệu khác thuộc workspace cha và không nằm trong Git repository này; các kết quả Docker ở trang này có thể đọc độc lập.

Git push đưa source lên GitHub. Hai image hiện nằm trên Docker local; chưa publish Docker Hub/GHCR. Giữ volumes khi stop/redeploy; làm theo runbook trước khi restore hoặc đổi image.
