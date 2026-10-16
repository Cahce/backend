# Chạy TLU Scholar Editor bằng Docker

Clone hai repo cùng một thư mục cha, giữ tên frontend như dưới đây:

```text
workspace/
  backend/
    compose.yaml
  Frontendtluscholareditor/
```

Chạy từ `backend/`. Stack riêng tên `tlu-scholar` gồm PostgreSQL, Fastify và frontend nginx; migration chạy một lần trước backend. Database và API không publish port. Web mặc định chỉ bind loopback tại **http://127.0.0.1:8080**, không chiếm dev3000/5173. Chia sẻ/chat được bật ở cả bundle và server, API cùng origin `/api/v1`.

## Cấu hình, build và chạy

Copy `deploy/.env.docker.example` thành `deploy/.env.docker`. Điền `POSTGRES_PASSWORD` bằng chuỗi hex ngẫu nhiên và `JWT_SECRET` đủ mạnh. File thật đã Git ignore và không vào Docker build context. Khi copy database hiện có, giữ `JWT_SECRET` nguồn để đọc được integration token đã mã hóa; không ghi secret vào commit hoặc lệnh được chia sẻ.

```powershell
docker compose --env-file deploy/.env.docker config --quiet
docker compose --env-file deploy/.env.docker build backend web
docker compose --env-file deploy/.env.docker up -d
docker compose --env-file deploy/.env.docker ps
curl.exe -fsS http://127.0.0.1:8080/health/ready
```

Fresh database chỉ có schema sau migration. Chủ động provision tài khoản trước khi sử dụng; stack không tự tạo tài khoản với mật khẩu mặc định. Nếu cần giữ dữ liệu đang dùng, thực hiện bước restore bên dưới **trước** `up -d` toàn bộ.

URL/PMID/ISBN capture dùng dịch vụ Zotero tùy chọn. Bật bằng `docker compose --env-file deploy/.env.docker --profile capture up -d`; DOI/arXiv vẫn có OpenAlex fallback khi profile chưa chạy. Profile này cần image Zotero hỗ trợ kiến trúc máy đích. Backend có 60 giây để shutdown, đủ cho deadline cleanup mặc định 40 giây.

## Bản sao dữ liệu hiện có

Không reset/migrate/seed database nguồn. Tạo logical custom-format backup bằng `pg_dump` cùng major hoặc mới hơn nguồn, không để password trên command line. Khởi động riêng `db`, restore bằng `pg_restore --no-owner --no-privileges --single-transaction --exit-on-error` vào database Docker mới và trống. Không restore đè một volume đang dùng. Backup là dữ liệu riêng tư: để ngoài Git/build context, ví dụ ignored `tmp/`.

```powershell
docker compose --env-file deploy/.env.docker up -d db
# Wait for db healthy; copy your private dump to the owned db container.
# Restore it as tlu into tluscholar, then verify counts/migration history.
docker compose --env-file deploy/.env.docker run --rm backend-migrate
```

Copy cả source storage và template storage vào hai named volumes `tlu-scholar_storage` và `tlu-scholar_templates`, với backend dừng. Mount thư mục nguồn read-only cho transfer container; chown destination về uid/gid1000 để backend `node` ghi được. Giữ DB dump và hai storage copies cùng một mốc vận hành; nếu nguồn vẫn đang nhận writes thì dừng writers hoặc dùng quy trình snapshot đồng bộ trước final cutover. Lần copy local không xóa nguồn.

PG18 volume mount là `/var/lib/postgresql`, để image giữ data dưới thư mục theo major. Không đổi về layout `/var/lib/postgresql/data` của image cũ. [Official image PGDATA documentation](https://github.com/docker-library/docs/blob/master/postgres/README.md#pgdata).

## Kiểm tra và bảo trì

`/health/ready` phải trả JSON200; `/student`, `/workspace/...`, `/share/...` phải trả SPA, còn file WASM không tồn tại phải404 thay vì HTML. Kiểm tra login, project files/PDF, ba mức link và WebSocket thông qua web8080. Nếu đổi URL/port, cập nhật `WEB_ORIGIN`, `PROJECT_REALTIME_ORIGINS` và port; cờ frontend thay đổi cần build lại image.

```powershell
docker compose --env-file deploy/.env.docker exec web nginx -t
docker compose --env-file deploy/.env.docker logs --tail 80 backend web
docker compose --env-file deploy/.env.docker stop
docker compose --env-file deploy/.env.docker up -d
```

`stop` giữ volumes. **Không dùng `down -v` cho stack chứa dữ liệu.** Backup DB và storage trước nâng cấp; rollback bằng image tags trước đó sau khi kiểm tra migration tương thích. Không tự rollback schema bằng reset. Các container/volumes của project khác không thuộc stack này.

Docker images chỉ local sau `build`; Git push không tự push images lên Docker Hub/GHCR. Publish registry cần chỉ định repository/tag riêng. Local container smoke không phải nghiệm thu10k CCU hoặc production rollout.
