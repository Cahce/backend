# Kết Quả Test Compile API

**Ngày**: 2026-05-05  
**Trạng thái**: Cần restart server

---

## Tóm Tắt

Đã tạo smoke test script cho Compile API và phát hiện vấn đề cấu hình.

---

## Test Script

**File**: `scripts/test-compile-api.ts`  
**Command**: `npm run test:api:compile`

**Test coverage**:
1. ✅ Login authentication
2. ✅ Create project
3. ✅ Create Typst file (POST /files)
4. ✅ Get project settings (auto-created)
5. ✅ Enqueue compile job (202 Accepted)
6. ⏳ Poll job status (stuck at "queued")
7. ⏳ Download PDF artifact
8. ✅ Error cases (401, 404)
9. ✅ Cleanup

---

## Vấn Đề Phát Hiện

### 1. ✅ FIXED: File Creation Endpoint

**Vấn đề**: Test ban đầu dùng PUT để tạo file mới, nhưng PUT chỉ dùng để update file đã tồn tại.

**Giải pháp**: Đổi sang POST `/api/v1/projects/{projectId}/files` với body:
```json
{
  "path": "main.typ",
  "kind": "typst",
  "content": "..."
}
```

**Kết quả**: ✅ File được tạo thành công

---

### 2. ⚠️ PENDING: Compile Worker Không Chạy

**Vấn đề**: Compile jobs stuck ở status "queued", không chuyển sang "running" hoặc "success".

**Nguyên nhân**: Thiếu `COMPILE_WORKER_ENABLED=true` trong `.env`

**Giải pháp**: 
1. Đã thêm `COMPILE_WORKER_ENABLED=true` vào `.env`
2. **CẦN RESTART SERVER** để worker được khởi động

**Cách restart**:
```powershell
# Trong terminal đang chạy server, nhấn Ctrl+C để dừng
# Sau đó chạy lại:
npm run dev
```

**Kiểm tra worker đã chạy**: Xem log khi server khởi động, phải có dòng:
```
[INFO] Compile worker started
```

---

## Cách Chạy Test

### Bước 1: Đảm Bảo Cấu Hình Đúng

Kiểm tra `.env` có các biến sau:
```env
# Compile
COMPILE_WORKER_ENABLED=true
COMPILE_TIMEOUT_MS=60000

# Storage
BLOB_STORAGE_DRIVER=local
STORAGE_DIR=./.storage
```

### Bước 2: Restart Server

```powershell
# Dừng server hiện tại (Ctrl+C)
# Khởi động lại
npm run dev
```

**Kiểm tra log**: Phải thấy dòng "Compile worker started"

### Bước 3: Seed Test Users

```powershell
npm run seed:users
```

**Kết quả**: Tạo user `2251172560@e.tlu.edu.vn` với password `123456`

### Bước 4: Chạy Test

```powershell
npm run test:api:compile
```

**Kết quả mong đợi**: Tất cả 10 tests pass

---

## Kết Quả Hiện Tại

### Tests Passed (7/10)
- ✅ Step 1: Login to get auth token
- ✅ Step 2: Create test project
- ✅ Step 3: Create main.typ file
- ✅ Step 4: Get project settings (auto-created)
- ✅ Step 5: Enqueue compile job
- ✅ Step 8b: Get artifact for non-existent job (404)
- ✅ Step 8c: Compile without auth token (401)
- ✅ Step 9: Cleanup - Delete test project

### Tests Failed (3/10)
- ❌ Step 6: Wait for compilation to complete
  - **Lý do**: Worker không chạy, job stuck ở "queued"
  - **Fix**: Restart server sau khi thêm COMPILE_WORKER_ENABLED=true
  
- ❌ Step 7: Download PDF artifact
  - **Lý do**: Không có artifact vì compile chưa hoàn thành
  - **Fix**: Sẽ pass sau khi Step 6 pass
  
- ❌ Step 8a: Compile with non-existent entry path (should fail)
  - **Lý do**: Worker không chạy nên không detect lỗi
  - **Fix**: Sẽ pass sau khi worker chạy

---

## Sau Khi Restart Server

Chạy lại test:
```powershell
npm run test:api:compile
```

**Kết quả mong đợi**:
```
============================================================
COMPILE API SMOKE TEST
============================================================

✓ Step 1: Login to get auth token
✓ Step 2: Create test project
✓ Step 3: Create main.typ file
✓ Step 4: Get project settings (auto-created)
✓ Step 5: Enqueue compile job
  Attempt 1/30 - Status: queued
  Attempt 2/30 - Status: running
  Attempt 3/30 - Status: success
  ✓ Compilation succeeded!
✓ Step 6: Wait for compilation to complete
  Content-Type: application/pdf
  PDF size: XXXX bytes
  ✓ Valid PDF file (header: %PDF)
✓ Step 7: Download PDF artifact
✓ Step 8a: Compile with non-existent entry path (should fail)
✓ Step 8b: Get artifact for non-existent job (404)
✓ Step 8c: Compile without auth token (401)
✓ Step 9: Cleanup - Delete test project

============================================================

Results: 10 passed, 0 failed

✅ ALL COMPILE API TESTS PASSED
```

---

## PowerShell Test Script

Ngoài TypeScript test, còn có PowerShell script để test thủ công:

**File**: `scripts/test-compile-flow.ps1`

**Cách chạy**:
```powershell
.\scripts\test-compile-flow.ps1
```

**Tính năng**:
- Test toàn bộ compile flow
- Tự động mở PDF sau khi tải về
- Hiển thị diagnostics nếu có lỗi
- Màu sắc rõ ràng (Green = success, Red = error)

---

## Checklist

- [x] Tạo TypeScript smoke test script
- [x] Thêm npm script `test:api:compile`
- [x] Fix file creation endpoint (POST thay vì PUT)
- [x] Thêm COMPILE_WORKER_ENABLED vào .env
- [ ] **TODO: Restart server để worker chạy**
- [ ] **TODO: Chạy lại test để verify tất cả pass**

---

## Next Steps

1. **Restart server** (quan trọng!)
2. Chạy `npm run test:api:compile`
3. Verify tất cả 10 tests pass
4. Nếu pass, cập nhật task list: T4.4 ✅ Complete

---

## Files Changed

1. `scripts/test-compile-api.ts` (NEW) - TypeScript smoke test
2. `package.json` - Thêm script `test:api:compile`
3. `.env` - Thêm `COMPILE_WORKER_ENABLED=true`
4. `docs/TEST_COMPILE_API_RESULTS.md` (NEW) - Tài liệu này

---

## References

- Task list: `.kiro/specs/editor-backend/tasks.md` (T4.4)
- Testing guide: `docs/HUONG_DAN_KIEM_TRA.md`
- PowerShell script: `scripts/test-compile-flow.ps1`
