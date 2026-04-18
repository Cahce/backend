import { PrismaClient } from "../src/generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding users...");

    const defaultPassword = "123456";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // Seed admin
    const admin = await prisma.user.upsert({
        where: { email: "admin@tlu.edu.vn" },
        update: {},
        create: {
            email: "admin@tlu.edu.vn",
            passwordHash,
            role: "admin",
            isActive: true,
        },
    });
    console.log("✓ Admin user:", admin.email);

    // Seed teacher
    const teacher = await prisma.user.upsert({
        where: { email: "kieutuandung@tlu.edu.vn" },
        update: {},
        create: {
            email: "kieutuandung@tlu.edu.vn",
            passwordHash,
            role: "teacher",
            isActive: true,
        },
    });
    console.log("✓ Teacher user:", teacher.email);

    // Seed student
    const student = await prisma.user.upsert({
        where: { email: "2251172560@e.tlu.edu.vn" },
        update: {},
        create: {
            email: "2251172560@e.tlu.edu.vn",
            passwordHash,
            role: "student",
            isActive: true,
        },
    });
    console.log("✓ Student user:", student.email);

    console.log("\nSeeding complete!");
    console.log("Default password for all accounts: 123456");
}

main()
    .catch((e) => {
        console.error("Seeding failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
