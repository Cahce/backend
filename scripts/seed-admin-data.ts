/**
 * Seed Admin Module Data
 * 
 * Seeds sample data for Faculty, Department, Major, Class, Teacher, and Student tables.
 * Run with: npx tsx scripts/seed-admin-data.ts
 */

import { PrismaClient } from '../src/generated/prisma/index.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
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

async function main() {
  console.log('🌱 Starting admin module data seeding...\n');

  // 1. Seed Faculties (5 khoa)
  console.log('📚 Seeding Faculties...');
  const faculties = await Promise.all([
    prisma.faculty.upsert({
      where: { code: 'CNTT' },
      update: {},
      create: {
        name: 'Khoa Công nghệ Thông tin',
        code: 'CNTT',
      },
    }),
    prisma.faculty.upsert({
      where: { code: 'KTDN' },
      update: {},
      create: {
        name: 'Khoa Kinh tế và Quản trị Kinh doanh',
        code: 'KTDN',
      },
    }),
    prisma.faculty.upsert({
      where: { code: 'KHTN' },
      update: {},
      create: {
        name: 'Khoa Khoa học Tự nhiên',
        code: 'KHTN',
      },
    }),
    prisma.faculty.upsert({
      where: { code: 'KTXD' },
      update: {},
      create: {
        name: 'Khoa Kỹ thuật và Công nghệ',
        code: 'KTXD',
      },
    }),
    prisma.faculty.upsert({
      where: { code: 'KHXH' },
      update: {},
      create: {
        name: 'Khoa Khoa học Xã hội và Nhân văn',
        code: 'KHXH',
      },
    }),
  ]);
  console.log(`✅ Created ${faculties.length} faculties\n`);

  // 2. Seed Departments (5 bộ môn - thuộc khoa CNTT)
  console.log('🏢 Seeding Departments...');
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'HTTT' },
      update: {},
      create: {
        name: 'Bộ môn Hệ thống Thông tin',
        code: 'HTTT',
        facultyId: faculties[0].id, // CNTT
      },
    }),
    prisma.department.upsert({
      where: { code: 'KHMT' },
      update: {},
      create: {
        name: 'Bộ môn Khoa học Máy tính',
        code: 'KHMT',
        facultyId: faculties[0].id, // CNTT
      },
    }),
    prisma.department.upsert({
      where: { code: 'KTPM' },
      update: {},
      create: {
        name: 'Bộ môn Kỹ thuật Phần mềm',
        code: 'KTPM',
        facultyId: faculties[0].id, // CNTT
      },
    }),
    prisma.department.upsert({
      where: { code: 'MMT' },
      update: {},
      create: {
        name: 'Bộ môn Mạng Máy tính và Truyền thông',
        code: 'MMT',
        facultyId: faculties[0].id, // CNTT
      },
    }),
    prisma.department.upsert({
      where: { code: 'ATTT' },
      update: {},
      create: {
        name: 'Bộ môn An toàn Thông tin',
        code: 'ATTT',
        facultyId: faculties[0].id, // CNTT
      },
    }),
  ]);
  console.log(`✅ Created ${departments.length} departments\n`);

  // 3. Seed Majors (5 ngành - thuộc khoa CNTT)
  console.log('🎓 Seeding Majors...');
  const majors = await Promise.all([
    prisma.major.upsert({
      where: { code: '7480201' },
      update: {},
      create: {
        name: 'Công nghệ Thông tin',
        code: '7480201',
        facultyId: faculties[0].id, // CNTT
      },
    }),
    prisma.major.upsert({
      where: { code: '7480103' },
      update: {},
      create: {
        name: 'Khoa học Máy tính',
        code: '7480103',
        facultyId: faculties[0].id, // CNTT
      },
    }),
    prisma.major.upsert({
      where: { code: '7480209' },
      update: {},
      create: {
        name: 'An toàn Thông tin',
        code: '7480209',
        facultyId: faculties[0].id, // CNTT
      },
    }),
    prisma.major.upsert({
      where: { code: '7480104' },
      update: {},
      create: {
        name: 'Trí tuệ Nhân tạo',
        code: '7480104',
        facultyId: faculties[0].id, // CNTT
      },
    }),
    prisma.major.upsert({
      where: { code: '7340406' },
      update: {},
      create: {
        name: 'Hệ thống Thông tin Quản lý',
        code: '7340406',
        facultyId: faculties[0].id, // CNTT
      },
    }),
  ]);
  console.log(`✅ Created ${majors.length} majors\n`);

  // 4. Seed Classes (5 lớp)
  console.log('👥 Seeding Classes...');
  const classes = await Promise.all([
    prisma.class.upsert({
      where: { code: '62PM1' },
      update: {},
      create: {
        name: 'Công nghệ Thông tin 62PM1',
        code: '62PM1',
        majorId: majors[0].id, // CNTT
      },
    }),
    prisma.class.upsert({
      where: { code: '62PM2' },
      update: {},
      create: {
        name: 'Công nghệ Thông tin 62PM2',
        code: '62PM2',
        majorId: majors[0].id, // CNTT
      },
    }),
    prisma.class.upsert({
      where: { code: '62TT1' },
      update: {},
      create: {
        name: 'Khoa học Máy tính 62TT1',
        code: '62TT1',
        majorId: majors[1].id, // KHMT
      },
    }),
    prisma.class.upsert({
      where: { code: '62AT1' },
      update: {},
      create: {
        name: 'An toàn Thông tin 62AT1',
        code: '62AT1',
        majorId: majors[2].id, // ATTT
      },
    }),
    prisma.class.upsert({
      where: { code: '62AI1' },
      update: {},
      create: {
        name: 'Trí tuệ Nhân tạo 62AI1',
        code: '62AI1',
        majorId: majors[3].id, // AI
      },
    }),
  ]);
  console.log(`✅ Created ${classes.length} classes\n`);

  // 5. Seed Teachers (5 giảng viên với accounts)
  console.log('👨‍🏫 Seeding Teachers...');
  const passwordHash = await bcrypt.hash('123456', 10);

  const teacherAccounts = await Promise.all([
    prisma.user.upsert({
      where: { email: 'nguyenvana@tlu.edu.vn' },
      update: {},
      create: {
        email: 'nguyenvana@tlu.edu.vn',
        role: 'teacher',
        passwordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'tranthib@tlu.edu.vn' },
      update: {},
      create: {
        email: 'tranthib@tlu.edu.vn',
        role: 'teacher',
        passwordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'levanc@tlu.edu.vn' },
      update: {},
      create: {
        email: 'levanc@tlu.edu.vn',
        role: 'teacher',
        passwordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'phamthid@tlu.edu.vn' },
      update: {},
      create: {
        email: 'phamthid@tlu.edu.vn',
        role: 'teacher',
        passwordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'hoangvane@tlu.edu.vn' },
      update: {},
      create: {
        email: 'hoangvane@tlu.edu.vn',
        role: 'teacher',
        passwordHash,
        isActive: true,
      },
    }),
  ]);

  const teachers = await Promise.all([
    prisma.teacher.upsert({
      where: { teacherCode: 'GV001' },
      update: {},
      create: {
        teacherCode: 'GV001',
        fullName: 'TS. Nguyễn Văn A',
        accountId: teacherAccounts[0].id,
        departmentId: departments[0].id, // HTTT
        academicRank: 'Giảng viên chính',
        academicDegree: 'Tiến sĩ',
        phone: '0912345001',
      },
    }),
    prisma.teacher.upsert({
      where: { teacherCode: 'GV002' },
      update: {},
      create: {
        teacherCode: 'GV002',
        fullName: 'PGS.TS. Trần Thị B',
        accountId: teacherAccounts[1].id,
        departmentId: departments[1].id, // KHMT
        academicRank: 'Phó Giáo sư',
        academicDegree: 'Tiến sĩ',
        phone: '0912345002',
      },
    }),
    prisma.teacher.upsert({
      where: { teacherCode: 'GV003' },
      update: {},
      create: {
        teacherCode: 'GV003',
        fullName: 'ThS. Lê Văn C',
        accountId: teacherAccounts[2].id,
        departmentId: departments[2].id, // KTPM
        academicRank: 'Giảng viên',
        academicDegree: 'Thạc sĩ',
        phone: '0912345003',
      },
    }),
    prisma.teacher.upsert({
      where: { teacherCode: 'GV004' },
      update: {},
      create: {
        teacherCode: 'GV004',
        fullName: 'TS. Phạm Thị D',
        accountId: teacherAccounts[3].id,
        departmentId: departments[3].id, // MMT
        academicRank: 'Giảng viên chính',
        academicDegree: 'Tiến sĩ',
        phone: '0912345004',
      },
    }),
    prisma.teacher.upsert({
      where: { teacherCode: 'GV005' },
      update: {},
      create: {
        teacherCode: 'GV005',
        fullName: 'GS.TS. Hoàng Văn E',
        accountId: teacherAccounts[4].id,
        departmentId: departments[4].id, // ATTT
        academicRank: 'Giáo sư',
        academicDegree: 'Tiến sĩ',
        phone: '0912345005',
      },
    }),
  ]);
  console.log(`✅ Created ${teachers.length} teachers with accounts\n`);

  // 6. Seed Students (5 sinh viên với accounts)
  console.log('👨‍🎓 Seeding Students...');
  
  const studentAccounts = await Promise.all([
    prisma.user.upsert({
      where: { email: '2251172001@e.tlu.edu.vn' },
      update: {},
      create: {
        email: '2251172001@e.tlu.edu.vn',
        role: 'student',
        passwordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: '2251172002@e.tlu.edu.vn' },
      update: {},
      create: {
        email: '2251172002@e.tlu.edu.vn',
        role: 'student',
        passwordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: '2251172003@e.tlu.edu.vn' },
      update: {},
      create: {
        email: '2251172003@e.tlu.edu.vn',
        role: 'student',
        passwordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: '2251172004@e.tlu.edu.vn' },
      update: {},
      create: {
        email: '2251172004@e.tlu.edu.vn',
        role: 'student',
        passwordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: '2251172005@e.tlu.edu.vn' },
      update: {},
      create: {
        email: '2251172005@e.tlu.edu.vn',
        role: 'student',
        passwordHash,
        isActive: true,
      },
    }),
  ]);

  const students = await Promise.all([
    prisma.student.upsert({
      where: { studentCode: '2251172001' },
      update: {},
      create: {
        studentCode: '2251172001',
        fullName: 'Nguyễn Văn An',
        accountId: studentAccounts[0].id,
        classId: classes[0].id, // 62PM1
        phone: '0987654001',
      },
    }),
    prisma.student.upsert({
      where: { studentCode: '2251172002' },
      update: {},
      create: {
        studentCode: '2251172002',
        fullName: 'Trần Thị Bình',
        accountId: studentAccounts[1].id,
        classId: classes[0].id, // 62PM1
        phone: '0987654002',
      },
    }),
    prisma.student.upsert({
      where: { studentCode: '2251172003' },
      update: {},
      create: {
        studentCode: '2251172003',
        fullName: 'Lê Văn Cường',
        accountId: studentAccounts[2].id,
        classId: classes[1].id, // 62PM2
        phone: '0987654003',
      },
    }),
    prisma.student.upsert({
      where: { studentCode: '2251172004' },
      update: {},
      create: {
        studentCode: '2251172004',
        fullName: 'Phạm Thị Dung',
        accountId: studentAccounts[3].id,
        classId: classes[2].id, // 62TT1
        phone: '0987654004',
      },
    }),
    prisma.student.upsert({
      where: { studentCode: '2251172005' },
      update: {},
      create: {
        studentCode: '2251172005',
        fullName: 'Hoàng Văn Em',
        accountId: studentAccounts[4].id,
        classId: classes[3].id, // 62AT1
        phone: '0987654005',
      },
    }),
  ]);
  console.log(`✅ Created ${students.length} students with accounts\n`);

  // Summary
  console.log('📊 Seeding Summary:');
  console.log(`   - Faculties: ${faculties.length}`);
  console.log(`   - Departments: ${departments.length}`);
  console.log(`   - Majors: ${majors.length}`);
  console.log(`   - Classes: ${classes.length}`);
  console.log(`   - Teachers: ${teachers.length} (with accounts)`);
  console.log(`   - Students: ${students.length} (with accounts)`);
  console.log('\n✨ Admin module data seeding completed successfully!');
  console.log('\n📝 Default password for all accounts: 123456');
  console.log('\n👨‍🏫 Teacher accounts:');
  teacherAccounts.forEach((acc, i) => {
    console.log(`   - ${acc.email} (${teachers[i].fullName})`);
  });
  console.log('\n👨‍🎓 Student accounts:');
  studentAccounts.forEach((acc, i) => {
    console.log(`   - ${acc.email} (${students[i].fullName})`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error seeding admin data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
