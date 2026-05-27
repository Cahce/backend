# Script kiểm tra compile flow tự động
# Chạy: .\scripts\test-compile-flow.ps1

$baseUrl = "http://localhost:3000"
$email = "student@example.com"
$password = "password123"

Write-Host "=== KIỂM TRA EDITOR BACKEND ===" -ForegroundColor Cyan
Write-Host ""

# Bước 1: Login
Write-Host "1. Đăng nhập..." -ForegroundColor Yellow
$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody
    
    $token = $loginResponse.accessToken
    Write-Host "   ✓ Đăng nhập thành công!" -ForegroundColor Green
    Write-Host "   User: $($loginResponse.user.email) ($($loginResponse.user.role))" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Lỗi đăng nhập: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Bước 2: Tạo project
Write-Host "2. Tạo dự án..." -ForegroundColor Yellow
$projectBody = @{
    title = "Test Compile Flow $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    category = "thesis"
} | ConvertTo-Json

try {
    $headers = @{
        Authorization = "Bearer $token"
    }
    
    $projectResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/projects" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $projectBody
    
    $projectId = $projectResponse.id
    Write-Host "   ✓ Tạo dự án thành công!" -ForegroundColor Green
    Write-Host "   Project ID: $projectId" -ForegroundColor Gray
    Write-Host "   Title: $($projectResponse.title)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Lỗi tạo dự án: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Bước 3: Tạo file Typst
Write-Host "3. Tạo file main.typ..." -ForegroundColor Yellow
$fileBody = @{
    content = @"
= Xin Chào Thế Giới

Đây là tài liệu test compile flow.

== Phần 1: Giới Thiệu

Đây là phần giới thiệu.

== Phần 2: Nội Dung

Đây là nội dung chính.

== Phần 3: Kết Luận

Đây là phần kết luận.
"@
} | ConvertTo-Json

try {
    $fileResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/projects/$projectId/files/main.typ" `
        -Method Put `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $fileBody
    
    Write-Host "   ✓ Tạo file thành công!" -ForegroundColor Green
    Write-Host "   Path: $($fileResponse.path)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Lỗi tạo file: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Bước 4: Kiểm tra settings
Write-Host "4. Kiểm tra project settings..." -ForegroundColor Yellow
try {
    $settingsResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/projects/$projectId/settings" `
        -Method Get `
        -Headers $headers
    
    Write-Host "   ✓ Lấy settings thành công!" -ForegroundColor Green
    Write-Host "   Main Path: $($settingsResponse.settings.mainPath)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Lỗi lấy settings: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Bước 5: Enqueue compile job
Write-Host "5. Bắt đầu biên dịch..." -ForegroundColor Yellow
$compileBody = @{
    entryPath = "main.typ"
} | ConvertTo-Json

try {
    $compileResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/projects/$projectId/compile" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $compileBody
    
    $jobId = $compileResponse.job.id
    Write-Host "   ✓ Tạo compile job thành công!" -ForegroundColor Green
    Write-Host "   Job ID: $jobId" -ForegroundColor Gray
    Write-Host "   Status: $($compileResponse.job.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Lỗi tạo compile job: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Bước 6: Poll job status
Write-Host "6. Đợi biên dịch hoàn thành..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$jobStatus = "queued"

while ($attempt -lt $maxAttempts -and $jobStatus -ne "success" -and $jobStatus -ne "failed") {
    Start-Sleep -Seconds 2
    $attempt++
    
    try {
        $jobResponse = Invoke-RestMethod -Uri "$baseUrl/api/v1/projects/$projectId/compile/$jobId" `
            -Method Get `
            -Headers $headers
        
        $jobStatus = $jobResponse.job.status
        Write-Host "   Attempt $attempt/$maxAttempts - Status: $jobStatus" -ForegroundColor Gray
        
        if ($jobStatus -eq "success") {
            Write-Host "   ✓ Biên dịch thành công!" -ForegroundColor Green
            Write-Host "   Artifact ID: $($jobResponse.job.latestArtifactId)" -ForegroundColor Gray
            break
        } elseif ($jobStatus -eq "failed") {
            Write-Host "   ✗ Biên dịch thất bại!" -ForegroundColor Red
            Write-Host "   Diagnostics:" -ForegroundColor Red
            $jobResponse.job.diagnostics | ForEach-Object {
                Write-Host "     - [$($_.severity)] $($_.message)" -ForegroundColor Red
                if ($_.file) {
                    Write-Host "       File: $($_.file) Line: $($_.range.start.line)" -ForegroundColor Red
                }
            }
            exit 1
        }
    } catch {
        Write-Host "   ✗ Lỗi kiểm tra job status: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

if ($jobStatus -ne "success") {
    Write-Host "   ✗ Timeout: Job không hoàn thành sau $maxAttempts attempts" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Bước 7: Download PDF
Write-Host "7. Tải PDF..." -ForegroundColor Yellow
$pdfPath = "test-output-$(Get-Date -Format 'yyyyMMdd-HHmmss').pdf"

try {
    Invoke-WebRequest -Uri "$baseUrl/api/v1/projects/$projectId/compile/$jobId/artifact" `
        -Headers $headers `
        -OutFile $pdfPath
    
    $fileSize = (Get-Item $pdfPath).Length
    Write-Host "   ✓ Tải PDF thành công!" -ForegroundColor Green
    Write-Host "   File: $pdfPath" -ForegroundColor Gray
    Write-Host "   Size: $fileSize bytes" -ForegroundColor Gray
    
    # Mở PDF
    Write-Host "   Đang mở PDF..." -ForegroundColor Gray
    Start-Process $pdfPath
} catch {
    Write-Host "   ✗ Lỗi tải PDF: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== KIỂM TRA HOÀN TẤT ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tất cả các bước đã thành công! ✓" -ForegroundColor Green
Write-Host ""
Write-Host "Thông tin:" -ForegroundColor Yellow
Write-Host "  - Project ID: $projectId" -ForegroundColor Gray
Write-Host "  - Job ID: $jobId" -ForegroundColor Gray
Write-Host "  - PDF: $pdfPath" -ForegroundColor Gray
Write-Host ""
Write-Host "Bạn có thể xem PDF đã được mở tự động." -ForegroundColor Cyan
