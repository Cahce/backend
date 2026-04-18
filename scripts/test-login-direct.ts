import { PrismaClient } from "../src/generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
console.log("Connection string:", connectionString?.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function test() {
    try {
        console.log("\n1. Testing database connection...");
        const testQuery = await pool.query("SELECT 1 as test");
        console.log("✓ Direct pool query works:", testQuery.rows);

        console.log("\n2. Testing Prisma connection...");
        const user = await prisma.user.findUnique({
            where: { email: "2251172560@e.tlu.edu.vn" },
        });
        console.log("✓ User found:", user ? `${user.email} (${user.role})` : "null");

        if (user && user.passwordHash) {
            console.log("\n3. Testing password verification...");
            const isValid = await bcrypt.compare("123456", user.passwordHash);
            console.log("✓ Password valid:", isValid);
        }
    } catch (error) {
        console.error("✗ Error:", error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

test();
