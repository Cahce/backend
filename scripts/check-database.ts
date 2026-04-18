/**
 * Database Connection and Data Check Script
 * Connects to the database and displays current data
 */

import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

// Create PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkDatabase() {
  console.log("🔌 Connecting to database...");
  console.log(`📍 Database URL: ${connectionString?.replace(/:[^:@]+@/, ':****@')}\n`);

  try {
    // Test connection
    await prisma.$connect();
    console.log("✅ Database connected successfully!\n");

    // Check Users
    console.log("=== Users ===");
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (users.length === 0) {
      console.log("  No users found");
    } else {
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email}`);
        console.log(`     Role: ${user.role}`);
        console.log(`     Active: ${user.isActive ? "Yes" : "No"}`);
        console.log(`     Created: ${user.createdAt.toISOString()}`);
        console.log();
      });
    }

    // Check Faculties
    console.log("=== Faculties ===");
    const faculties = await prisma.faculty.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        _count: {
          select: {
            departments: true,
            majors: true,
          },
        },
      },
    });

    if (faculties.length === 0) {
      console.log("  No faculties found");
    } else {
      faculties.forEach((faculty, index) => {
        console.log(`  ${index + 1}. ${faculty.name} (${faculty.code})`);
        console.log(`     Departments: ${faculty._count.departments}`);
        console.log(`     Majors: ${faculty._count.majors}`);
        console.log();
      });
    }

    // Check Departments
    console.log("=== Departments ===");
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        faculty: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            teachers: true,
          },
        },
      },
    });

    if (departments.length === 0) {
      console.log("  No departments found");
    } else {
      departments.forEach((dept, index) => {
        console.log(`  ${index + 1}. ${dept.name} (${dept.code})`);
        console.log(`     Faculty: ${dept.faculty.name}`);
        console.log(`     Teachers: ${dept._count.teachers}`);
        console.log();
      });
    }

    // Check Majors
    console.log("=== Majors ===");
    const majors = await prisma.major.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        faculty: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            classes: true,
          },
        },
      },
    });

    if (majors.length === 0) {
      console.log("  No majors found");
    } else {
      majors.forEach((major, index) => {
        console.log(`  ${index + 1}. ${major.name} (${major.code})`);
        console.log(`     Faculty: ${major.faculty.name}`);
        console.log(`     Classes: ${major._count.classes}`);
        console.log();
      });
    }

    // Check Classes
    console.log("=== Classes ===");
    const classes = await prisma.class.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        major: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (classes.length === 0) {
      console.log("  No classes found");
    } else {
      classes.forEach((cls, index) => {
        console.log(`  ${index + 1}. ${cls.name} (${cls.code})`);
        console.log(`     Major: ${cls.major.name}`);
        console.log(`     Students: ${cls._count.students}`);
        console.log();
      });
    }

    // Check Teachers
    console.log("=== Teachers ===");
    const teachers = await prisma.teacher.findMany({
      select: {
        id: true,
        teacherCode: true,
        fullName: true,
        department: {
          select: {
            name: true,
          },
        },
        account: {
          select: {
            email: true,
          },
        },
      },
    });

    if (teachers.length === 0) {
      console.log("  No teachers found");
    } else {
      teachers.forEach((teacher, index) => {
        console.log(`  ${index + 1}. ${teacher.fullName} (${teacher.teacherCode})`);
        console.log(`     Department: ${teacher.department.name}`);
        console.log(`     Account: ${teacher.account?.email || "Not linked"}`);
        console.log();
      });
    }

    // Check Students
    console.log("=== Students ===");
    const students = await prisma.student.findMany({
      select: {
        id: true,
        studentCode: true,
        fullName: true,
        class: {
          select: {
            name: true,
          },
        },
        account: {
          select: {
            email: true,
          },
        },
      },
    });

    if (students.length === 0) {
      console.log("  No students found");
    } else {
      students.forEach((student, index) => {
        console.log(`  ${index + 1}. ${student.fullName} (${student.studentCode})`);
        console.log(`     Class: ${student.class.name}`);
        console.log(`     Account: ${student.account?.email || "Not linked"}`);
        console.log();
      });
    }

    // Summary
    console.log("=== Summary ===");
    console.log(`  Users: ${users.length}`);
    console.log(`  Faculties: ${faculties.length}`);
    console.log(`  Departments: ${departments.length}`);
    console.log(`  Majors: ${majors.length}`);
    console.log(`  Classes: ${classes.length}`);
    console.log(`  Teachers: ${teachers.length}`);
    console.log(`  Students: ${students.length}`);

    console.log("\n✅ Database check complete!");
  } catch (error) {
    console.error("❌ Error connecting to database:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkDatabase();
