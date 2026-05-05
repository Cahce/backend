/**
 * Seed Test Projects with Typst Files
 * 
 * Creates sample projects with Typst files for testing compile API on Swagger.
 * Run with: npx tsx scripts/seed-test-projects.ts
 */

import { PrismaClient } from '../src/generated/prisma/index.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Sample Typst content
const SAMPLE_TYPST_SIMPLE = `= Xin Chào Thế Giới

Đây là tài liệu Typst đơn giản để test compile API.

== Giới Thiệu

Typst là một hệ thống sắp chữ hiện đại, được thiết kế để dễ sử dụng và mạnh mẽ.

== Nội Dung

Đây là nội dung chính của tài liệu.

=== Mục 1

Nội dung mục 1.

=== Mục 2

Nội dung mục 2.

== Kết Luận

Đây là phần kết luận.
`;

const SAMPLE_TYPST_MATH = `= Tài Liệu Toán Học

Tài liệu này chứa các công thức toán học.

== Công Thức Cơ Bản

Phương trình bậc hai: $a x^2 + b x + c = 0$

Nghiệm của phương trình:

$ x = (-b plus.minus sqrt(b^2 - 4a c)) / (2a) $

== Tích Phân

Tích phân cơ bản:

$ integral_a^b f(x) dif x $

Ví dụ:

$ integral_0^1 x^2 dif x = [x^3 / 3]_0^1 = 1/3 $

== Ma Trận

Ma trận đơn vị:

$ mat(
  1, 0, 0;
  0, 1, 0;
  0, 0, 1;
) $
`;

const SAMPLE_TYPST_THESIS = `#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2cm),
)

#set text(
  font: "New Computer Modern",
  size: 12pt,
)

#set par(
  justify: true,
  leading: 0.65em,
)

#align(center)[
  #text(size: 18pt, weight: "bold")[
    ĐẠI HỌC THĂNG LONG
  ]
  
  #v(0.5cm)
  
  #text(size: 16pt, weight: "bold")[
    KHÓA LUẬN TỐT NGHIỆP
  ]
  
  #v(1cm)
  
  #text(size: 14pt)[
    Đề tài: Xây dựng hệ thống soạn thảo tài liệu Typst
  ]
  
  #v(2cm)
  
  #text(size: 12pt)[
    Sinh viên thực hiện: Nguyễn Văn A
    
    Mã sinh viên: 2251172001
    
    Lớp: 62PM1
  ]
  
  #v(1cm)
  
  #text(size: 12pt)[
    Giảng viên hướng dẫn: TS. Nguyễn Văn B
  ]
  
  #v(2cm)
  
  #text(size: 12pt)[
    Hà Nội, 2026
  ]
]

#pagebreak()

= Lời Cảm Ơn

Em xin chân thành cảm ơn...

#pagebreak()

= Chương 1: Giới Thiệu

== 1.1 Đặt Vấn Đề

Trong thời đại số hóa...

== 1.2 Mục Tiêu Nghiên Cứu

Mục tiêu của đề tài là...

= Chương 2: Cơ Sở Lý Thuyết

== 2.1 Typst

Typst là một hệ thống sắp chữ...

== 2.2 Kiến Trúc Hệ Thống

Hệ thống được xây dựng theo mô hình...
`;

const SAMPLE_TYPST_ERROR = `= Tài Liệu Có Lỗi

Đây là tài liệu có lỗi cú pháp để test error handling.

== Lỗi Cú Pháp

#let x = 10
#let y = 20
#let z = x + y + // Thiếu toán hạng

== Lỗi Hàm

#unknown_function() // Hàm không tồn tại

== Lỗi Biến

#let result = undefined_variable * 2 // Biến không được định nghĩa
`;

async function main() {
  console.log('🌱 Starting test projects seeding...\n');

  // Get existing users
  const student = await prisma.user.findUnique({
    where: { email: '2251172560@e.tlu.edu.vn' },
  });

  const teacher = await prisma.user.findUnique({
    where: { email: 'kieutuandung@tlu.edu.vn' },
  });

  if (!student || !teacher) {
    console.error('❌ Required users not found. Please run seed-users.ts first.');
    process.exit(1);
  }

  console.log('✅ Found users:');
  console.log(`   - Student: ${student.email}`);
  console.log(`   - Teacher: ${teacher.email}\n`);

  // 1. Create Simple Project
  console.log('📁 Creating Simple Project...');
  const simpleProject = await prisma.project.upsert({
    where: { id: 'test-simple-project' },
    update: {},
    create: {
      id: 'test-simple-project',
      title: 'Tài Liệu Đơn Giản',
      category: 'report',
      ownerId: student.id,
    },
  });

  await prisma.file.upsert({
    where: { 
      projectId_path: {
        projectId: simpleProject.id,
        path: 'main.typ',
      },
    },
    update: {},
    create: {
      projectId: simpleProject.id,
      path: 'main.typ',
      kind: 'typst',
      textContent: SAMPLE_TYPST_SIMPLE,
      sizeBytes: Buffer.byteLength(SAMPLE_TYPST_SIMPLE, 'utf-8'),
    },
  });

  console.log(`✅ Created: ${simpleProject.title}`);
  console.log(`   - ID: ${simpleProject.id}`);
  console.log(`   - Files: main.typ\n`);

  // 2. Create Math Project
  console.log('📁 Creating Math Project...');
  const mathProject = await prisma.project.upsert({
    where: { id: 'test-math-project' },
    update: {},
    create: {
      id: 'test-math-project',
      title: 'Tài Liệu Toán Học',
      category: 'report',
      ownerId: student.id,
    },
  });

  await prisma.file.upsert({
    where: { 
      projectId_path: {
        projectId: mathProject.id,
        path: 'main.typ',
      },
    },
    update: {},
    create: {
      projectId: mathProject.id,
      path: 'main.typ',
      kind: 'typst',
      textContent: SAMPLE_TYPST_MATH,
      sizeBytes: Buffer.byteLength(SAMPLE_TYPST_MATH, 'utf-8'),
    },
  });

  console.log(`✅ Created: ${mathProject.title}`);
  console.log(`   - ID: ${mathProject.id}`);
  console.log(`   - Files: main.typ\n`);

  // 3. Create Thesis Project
  console.log('📁 Creating Thesis Project...');
  const thesisProject = await prisma.project.upsert({
    where: { id: 'test-thesis-project' },
    update: {},
    create: {
      id: 'test-thesis-project',
      title: 'Khóa Luận Tốt Nghiệp',
      category: 'thesis',
      ownerId: student.id,
    },
  });

  await prisma.file.upsert({
    where: { 
      projectId_path: {
        projectId: thesisProject.id,
        path: 'main.typ',
      },
    },
    update: {},
    create: {
      projectId: thesisProject.id,
      path: 'main.typ',
      kind: 'typst',
      textContent: SAMPLE_TYPST_THESIS,
      sizeBytes: Buffer.byteLength(SAMPLE_TYPST_THESIS, 'utf-8'),
    },
  });

  console.log(`✅ Created: ${thesisProject.title}`);
  console.log(`   - ID: ${thesisProject.id}`);
  console.log(`   - Files: main.typ\n`);

  // 4. Create Error Project (for testing error handling)
  console.log('📁 Creating Error Project...');
  const errorProject = await prisma.project.upsert({
    where: { id: 'test-error-project' },
    update: {},
    create: {
      id: 'test-error-project',
      title: 'Tài Liệu Có Lỗi (Test)',
      category: 'report',
      ownerId: student.id,
    },
  });

  await prisma.file.upsert({
    where: { 
      projectId_path: {
        projectId: errorProject.id,
        path: 'main.typ',
      },
    },
    update: {},
    create: {
      projectId: errorProject.id,
      path: 'main.typ',
      kind: 'typst',
      textContent: SAMPLE_TYPST_ERROR,
      sizeBytes: Buffer.byteLength(SAMPLE_TYPST_ERROR, 'utf-8'),
    },
  });

  console.log(`✅ Created: ${errorProject.title}`);
  console.log(`   - ID: ${errorProject.id}`);
  console.log(`   - Files: main.typ\n`);

  // 5. Create Teacher's Project
  console.log('📁 Creating Teacher Project...');
  const teacherProject = await prisma.project.upsert({
    where: { id: 'test-teacher-project' },
    update: {},
    create: {
      id: 'test-teacher-project',
      title: 'Giáo Trình Typst',
      category: 'other',
      ownerId: teacher.id,
    },
  });

  const teacherContent = `= Giáo Trình Typst

Giáo trình hướng dẫn sử dụng Typst cho sinh viên.

== Bài 1: Giới Thiệu

Typst là gì?

== Bài 2: Cú Pháp Cơ Bản

Các cú pháp cơ bản trong Typst.

== Bài 3: Công Thức Toán Học

Cách viết công thức toán học trong Typst.
`;

  await prisma.file.upsert({
    where: { 
      projectId_path: {
        projectId: teacherProject.id,
        path: 'main.typ',
      },
    },
    update: {},
    create: {
      projectId: teacherProject.id,
      path: 'main.typ',
      kind: 'typst',
      textContent: teacherContent,
      sizeBytes: Buffer.byteLength(teacherContent, 'utf-8'),
    },
  });

  console.log(`✅ Created: ${teacherProject.title}`);
  console.log(`   - ID: ${teacherProject.id}`);
  console.log(`   - Files: main.typ\n`);

  // Summary
  console.log('📊 Seeding Summary:');
  console.log('   ✅ 5 test projects created');
  console.log('   ✅ 5 Typst files created');
  console.log('\n✨ Test projects seeding completed successfully!\n');

  console.log('📝 Test Projects:');
  console.log(`   1. ${simpleProject.title} (ID: ${simpleProject.id})`);
  console.log(`      - Simple document for basic testing`);
  console.log(`   2. ${mathProject.title} (ID: ${mathProject.id})`);
  console.log(`      - Document with math formulas`);
  console.log(`   3. ${thesisProject.title} (ID: ${thesisProject.id})`);
  console.log(`      - Thesis template with formatting`);
  console.log(`   4. ${errorProject.title} (ID: ${errorProject.id})`);
  console.log(`      - Document with syntax errors (for error handling test)`);
  console.log(`   5. ${teacherProject.title} (ID: ${teacherProject.id})`);
  console.log(`      - Teacher's project`);

  console.log('\n🔑 Login Credentials:');
  console.log(`   Student: ${student.email} / 123456`);
  console.log(`   Teacher: ${teacher.email} / 123456`);

  console.log('\n🧪 How to Test on Swagger:');
  console.log('   1. Go to http://localhost:3000/docs');
  console.log('   2. Login with student or teacher account');
  console.log('   3. Click "Authorize" and paste the accessToken');
  console.log('   4. Try these endpoints:');
  console.log('      - GET /api/v1/projects (list all projects)');
  console.log('      - GET /api/v1/projects/{id} (get project details)');
  console.log('      - GET /api/v1/projects/{id}/files (list files)');
  console.log('      - GET /api/v1/projects/{id}/settings (get settings)');
  console.log('      - POST /api/v1/projects/{id}/compile (compile document)');
  console.log('      - GET /api/v1/projects/{id}/compile/{jobId} (check status)');
  console.log('      - GET /api/v1/projects/{id}/compile/{jobId}/artifact (download PDF)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding test projects:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
