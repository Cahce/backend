# Seed Data Scripts

## Overview
Scripts để tạo dữ liệu mẫu cho database.

## Available Scripts

### 1. Seed Admin Module Data
Tạo dữ liệu mẫu cho module admin (Faculty, Department, Major, Class, Teacher, Student).

```bash
npm run seed:admin
```

**Dữ liệu được tạo:**
- 5 Faculties (Khoa)
- 5 Departments (Bộ môn) - thuộc Khoa CNTT
- 5 Majors (Ngành) - thuộc Khoa CNTT
- 5 Classes (Lớp)
- 5 Teachers (Giảng viên) với accounts
- 5 Students (Sinh viên) với accounts

**Mật khẩu mặc định:** `123456`

### 2. Seed Users
Tạo user accounts cơ bản.

```bash
npm run seed:users
```

### 3. Seed All
Chạy tất cả seed scripts.

```bash
npm run seed:all
```

## Sample Data Details

### Faculties (Khoa)
1. **CNTT** - Khoa Công nghệ Thông tin
2. **KTDN** - Khoa Kinh tế và Quản trị Kinh doanh
3. **KHTN** - Khoa Khoa học Tự nhiên
4. **KTXD** - Khoa Kỹ thuật và Công nghệ
5. **KHXH** - Khoa Khoa học Xã hội và Nhân văn

### Departments (Bộ môn - thuộc CNTT)
1. **HTTT** - Bộ môn Hệ thống Thông tin
2. **KHMT** - Bộ môn Khoa học Máy tính
3. **KTPM** - Bộ môn Kỹ thuật Phần mềm
4. **MMT** - Bộ môn Mạng Máy tính và Truyền thông
5. **ATTT** - Bộ môn An toàn Thông tin

### Majors (Ngành - thuộc CNTT)
1. **7480201** - Công nghệ Thông tin
2. **7480103** - Khoa học Máy tính
3. **7480209** - An toàn Thông tin
4. **7480104** - Trí tuệ Nhân tạo
5. **7340406** - Hệ thống Thông tin Quản lý

### Classes (Lớp)
1. **62PM1** - Công nghệ Thông tin 62PM1
2. **62PM2** - Công nghệ Thông tin 62PM2
3. **62TT1** - Khoa học Máy tính 62TT1
4. **62AT1** - An toàn Thông tin 62AT1
5. **62AI1** - Trí tuệ Nhân tạo 62AI1

### Teachers (Giảng viên)
| Mã GV | Họ tên | Email | Bộ môn | Học hàm | Học vị |
|-------|--------|-------|--------|---------|--------|
| GV001 | TS. Nguyễn Văn A | nguyenvana@tlu.edu.vn | HTTT | Giảng viên chính | Tiến sĩ |
| GV002 | PGS.TS. Trần Thị B | tranthib@tlu.edu.vn | KHMT | Phó Giáo sư | Tiến sĩ |
| GV003 | ThS. Lê Văn C | levanc@tlu.edu.vn | KTPM | Giảng viên | Thạc sĩ |
| GV004 | TS. Phạm Thị D | phamthid@tlu.edu.vn | MMT | Giảng viên chính | Tiến sĩ |
| GV005 | GS.TS. Hoàng Văn E | hoangvane@tlu.edu.vn | ATTT | Giáo sư | Tiến sĩ |

### Students (Sinh viên)
| Mã SV | Họ tên | Email | Lớp |
|-------|--------|-------|-----|
| 2251172001 | Nguyễn Văn An | 2251172001@e.tlu.edu.vn | 62PM1 |
| 2251172002 | Trần Thị Bình | 2251172002@e.tlu.edu.vn | 62PM1 |
| 2251172003 | Lê Văn Cường | 2251172003@e.tlu.edu.vn | 62PM2 |
| 2251172004 | Phạm Thị Dung | 2251172004@e.tlu.edu.vn | 62TT1 |
| 2251172005 | Hoàng Văn Em | 2251172005@e.tlu.edu.vn | 62AT1 |

## Usage Examples

### Login as Teacher
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nguyenvana@tlu.edu.vn",
    "password": "123456"
  }'
```

### Login as Student
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "2251172001@e.tlu.edu.vn",
    "password": "123456"
  }'
```

### Get User Info with Profile
```bash
curl -X GET "http://localhost:3000/api/v1/auth/user/2251172001@e.tlu.edu.vn" \
  -H "Authorization: Bearer <token>"
```

## Notes

- Script sử dụng `upsert` nên có thể chạy nhiều lần mà không tạo duplicate data
- Tất cả accounts đều có mật khẩu mặc định: `123456`
- Dữ liệu được tạo theo cấu trúc thực tế của Đại học Thăng Long
- Teacher và Student profiles được link với User accounts
- Relationships giữa các bảng được thiết lập đúng (Faculty → Department → Major → Class → Student)

## Troubleshooting

### Error: Unique constraint violation
Nếu gặp lỗi unique constraint, có thể do:
1. Data đã tồn tại - Script sẽ update thay vì tạo mới
2. Email hoặc code bị trùng - Kiểm tra database

### Error: Foreign key constraint
Đảm bảo chạy migrations trước:
```bash
npm run prisma:migrate
```

### Reset Database
Nếu muốn reset và seed lại từ đầu:
```bash
npx prisma migrate reset
npm run seed:all
```
