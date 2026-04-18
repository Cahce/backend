/**
 * Seed Test Accounts Script
 * Creates teacher and student test accounts for authorization testing
 */

import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

dotenv.config();

// Create PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedTestAccounts() {
  console.log("🌱 Seeding test accounts...\n");

  try {
    // Check if accounts already exist
    const existingTeacher = await prisma.user.findUnique({
      where: { email: "kieutuandung@tlu.edu.vn" },
    });

    const existingStudent = await prisma.user.findUnique({
      where: { email: "2251172560@e.tlu.edu.vn" },
    });

    // Create teacher account if doesn't exist
    if (!existingTeacher) {
      const hashedPassword = await bcrypt.hash("123456", 10);
      await prisma.user.create({
        data: {
          email: "kieutuandung@tlu.edu.vn",
          password: hashedPassword,
          role: "teacher",
          isActive: true,
        },
      });
      console.log("✅ Created teacher account: kieutuandung@tlu.edu.vn");
    } else {
      console.log("ℹ️  Teacher account already exists: kieutuandung@tlu.edu.vn");
    }

    // Create student account if doesn't exist
    if (!existingStudent) {
      const hashedPassword = await bcrypt.hash("123456", 10);
      await prisma.user.create({
        data: {
          email: "2251172560@e.tlu.edu.vn",
          password: hashedPassword,
          role: "student",
          isActive: true,
        },
      });
      console.log("✅ Created student account: 2251172560@e.tlu.edu.vn");
    } else {
      console.log("ℹ️  Student account already exists: 2251172560@e.tlu.edu.vn");
    }

    // List all users
    console.log("\n📋 All users in database:");
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    allUsers.forEach((user) => {
      console.log(`  - ${user.email} (${user.role}) ${user.isActive ? "✓" : "✗"}`);
    });

    console.log("\n✅ Test accounts ready!");
    console.log("\nTest credentials:");
    console.log("  Admin:   admin@tlu.edu.vn / 123456");
    console.log("  Teacher: kieutuandung@tlu.edu.vn / 123456");
    console.log("  Student: 2251172560@e.tlu.edu.vn / 123456");
  } catch (error) {
    console.error("❌ Error seeding test accounts:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedTestAccounts();
