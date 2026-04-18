/**
 * Check for SSO-only accounts (accounts without passwords)
 */

import dotenv from "dotenv";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkSSOAccounts() {
  console.log("🔍 Checking for SSO-only accounts (passwordHash IS NULL)...\n");

  try {
    const ssoOnlyAccounts = await prisma.user.findMany({
      where: {
        passwordHash: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (ssoOnlyAccounts.length > 0) {
      console.log("⚠️  WARNING: Found SSO-only accounts without passwords:");
      console.log("=" .repeat(60));
      ssoOnlyAccounts.forEach((account, index) => {
        console.log(`${index + 1}. ${account.email} (${account.role})`);
        console.log(`   ID: ${account.id}`);
        console.log(`   Created: ${account.createdAt.toISOString()}`);
        console.log();
      });
      console.log("🛑 STOP: You must set passwords for these accounts before proceeding!");
      console.log("   Run a script to set default passwords or migrate them.");
      process.exit(1);
    } else {
      console.log("✅ No SSO-only accounts found. Safe to proceed.");
    }
  } catch (error) {
    console.error("❌ Error checking SSO accounts:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkSSOAccounts();
