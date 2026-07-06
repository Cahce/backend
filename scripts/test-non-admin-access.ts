
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

const ADMIN_EMAIL = "admin@tlu.edu.vn";
const TEACHER_EMAIL = "kieutuandung@tlu.edu.vn";
const STUDENT_EMAIL = "2251172560@e.tlu.edu.vn";
const PASSWORD = "123456";

let adminToken = "";
let teacherToken = "";
let studentToken = "";

async function apiRequest(
  method: string,
  path: string,
  token?: string,
  body?: any
): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    return { data, status: response.status, ok: response.ok };
  } catch (error) {
    console.error(`❌ ${method} ${path} error:`, error);
    return { error, status: 0, ok: false };
  }
}

async function login(email: string, password: string): Promise<string | null> {
  const result = await apiRequest("POST", "/api/v1/auth/login", undefined, {
    email,
    password,
  });

  if (result.data?.accessToken) {
    return result.data.accessToken;
  }
  return null;
}

async function testAuthentication() {
  console.log("\n=== Testing Authentication for All Roles ===\n");

  console.log("1. Logging in as Admin...");
  adminToken = await login(ADMIN_EMAIL, PASSWORD);
  if (adminToken) {
    console.log(`✅ Admin login successful`);
  } else {
    console.error("❌ Admin login failed");
    return false;
  }

  console.log("\n2. Logging in as Teacher...");
  teacherToken = await login(TEACHER_EMAIL, PASSWORD);
  if (teacherToken) {
    console.log(`✅ Teacher login successful`);
  } else {
    console.error("❌ Teacher login failed - account may not exist");
    console.log("   Run: npx tsx scripts/seed-test-accounts.ts");
    return false;
  }

  console.log("\n3. Logging in as Student...");
  studentToken = await login(STUDENT_EMAIL, PASSWORD);
  if (studentToken) {
    console.log(`✅ Student login successful`);
  } else {
    console.error("❌ Student login failed - account may not exist");
    console.log("   Run: npx tsx scripts/seed-test-accounts.ts");
    return false;
  }

  return true;
}

async function testAdminAccess() {
  console.log("\n=== Testing Admin Access with Admin Token ===\n");

  const endpoints = [
    { method: "GET", path: "/api/v1/admin/faculties", desc: "List Faculties" },
    { method: "GET", path: "/api/v1/admin/departments", desc: "List Departments" },
    { method: "GET", path: "/api/v1/admin/teachers", desc: "List Teachers" },
    { method: "GET", path: "/api/v1/admin/students", desc: "List Students" },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const endpoint of endpoints) {
    const result = await apiRequest(endpoint.method, endpoint.path, adminToken);

    if (result.ok && result.status === 200) {
      console.log(`✅ ${endpoint.desc}: Access granted (200)`);
      successCount++;
    } else {
      console.error(`❌ ${endpoint.desc}: Access denied (${result.status})`);
      console.error(`   Error:`, result.data);
      failCount++;
    }
  }

  console.log(`\n📊 Admin Access Results: ${successCount} passed, ${failCount} failed`);
  return failCount === 0;
}

async function testTeacherAccessToAdminEndpoints() {
  console.log("\n=== Testing Teacher Access to Admin Endpoints (should be FORBIDDEN) ===\n");

  const endpoints = [
    { method: "GET", path: "/api/v1/admin/faculties", desc: "List Faculties" },
    { method: "GET", path: "/api/v1/admin/departments", desc: "List Departments" },
    { method: "GET", path: "/api/v1/admin/majors", desc: "List Majors" },
    { method: "GET", path: "/api/v1/admin/classes", desc: "List Classes" },
    { method: "GET", path: "/api/v1/admin/teachers", desc: "List Teachers" },
    { method: "GET", path: "/api/v1/admin/students", desc: "List Students" },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const endpoint of endpoints) {
    const result = await apiRequest(endpoint.method, endpoint.path, teacherToken);

    if (!result.ok && result.status === 403) {
      console.log(`✅ ${endpoint.desc}: Correctly forbidden (403)`);
      console.log(`   Message: ${result.data?.error?.message || "Forbidden"}`);
      successCount++;
    } else if (result.ok && result.status === 200) {
      console.error(`❌ ${endpoint.desc}: SECURITY ISSUE - Teacher can access! (${result.status})`);
      console.error(`   This is a CRITICAL security vulnerability!`);
      failCount++;
    } else {
      console.error(`❌ ${endpoint.desc}: Unexpected status (${result.status})`);
      console.error(`   Expected 403, got ${result.status}`);
      failCount++;
    }
  }

  console.log(`\n📊 Teacher Access Results: ${successCount} correctly forbidden, ${failCount} SECURITY ISSUES`);
  return failCount === 0;
}

async function testStudentAccessToAdminEndpoints() {
  console.log("\n=== Testing Student Access to Admin Endpoints (should be FORBIDDEN) ===\n");

  const endpoints = [
    { method: "GET", path: "/api/v1/admin/faculties", desc: "List Faculties" },
    { method: "GET", path: "/api/v1/admin/departments", desc: "List Departments" },
    { method: "GET", path: "/api/v1/admin/majors", desc: "List Majors" },
    { method: "GET", path: "/api/v1/admin/classes", desc: "List Classes" },
    { method: "GET", path: "/api/v1/admin/teachers", desc: "List Teachers" },
    { method: "GET", path: "/api/v1/admin/students", desc: "List Students" },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const endpoint of endpoints) {
    const result = await apiRequest(endpoint.method, endpoint.path, studentToken);

    if (!result.ok && result.status === 403) {
      console.log(`✅ ${endpoint.desc}: Correctly forbidden (403)`);
      console.log(`   Message: ${result.data?.error?.message || "Forbidden"}`);
      successCount++;
    } else if (result.ok && result.status === 200) {
      console.error(`❌ ${endpoint.desc}: SECURITY ISSUE - Student can access! (${result.status})`);
      console.error(`   This is a CRITICAL security vulnerability!`);
      failCount++;
    } else {
      console.error(`❌ ${endpoint.desc}: Unexpected status (${result.status})`);
      console.error(`   Expected 403, got ${result.status}`);
      failCount++;
    }
  }

  console.log(`\n📊 Student Access Results: ${successCount} correctly forbidden, ${failCount} SECURITY ISSUES`);
  return failCount === 0;
}

async function testTeacherCRUDAttempts() {
  console.log("\n=== Testing Teacher CRUD Attempts (should all be FORBIDDEN) ===\n");

  const operations = [
    {
      method: "POST",
      path: "/api/v1/admin/faculties",
      body: { name: "Test Faculty", code: "TEST" },
      desc: "Create Faculty",
    },
    {
      method: "PUT",
      path: "/api/v1/admin/faculties/fake-id",
      body: { name: "Updated Faculty" },
      desc: "Update Faculty",
    },
    {
      method: "DELETE",
      path: "/api/v1/admin/faculties/fake-id",
      desc: "Delete Faculty",
    },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const op of operations) {
    const result = await apiRequest(op.method, op.path, teacherToken, op.body);

    if (!result.ok && result.status === 403) {
      console.log(`✅ ${op.desc}: Correctly forbidden (403)`);
      successCount++;
    } else if (result.ok) {
      console.error(`❌ ${op.desc}: SECURITY ISSUE - Teacher can perform CRUD! (${result.status})`);
      failCount++;
    } else {
      console.error(`❌ ${op.desc}: Unexpected status (${result.status})`);
      failCount++;
    }
  }

  console.log(`\n📊 Teacher CRUD Results: ${successCount} correctly forbidden, ${failCount} SECURITY ISSUES`);
  return failCount === 0;
}

async function testAuthEndpointsForAllRoles() {
  console.log("\n=== Testing Auth Endpoints (should work for all authenticated users) ===\n");

  const tests = [
    { role: "Admin", token: adminToken },
    { role: "Teacher", token: teacherToken },
    { role: "Student", token: studentToken },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const test of tests) {
    const result = await apiRequest("GET", "/api/v1/auth/me", test.token);

    if (result.ok && result.status === 200) {
      console.log(`✅ ${test.role} can access /auth/me (200)`);
      console.log(`   User: ${result.data.user.email} (${result.data.user.role})`);
      successCount++;
    } else {
      console.error(`❌ ${test.role} cannot access /auth/me (${result.status})`);
      failCount++;
    }
  }

  console.log(`\n📊 Auth Endpoints Results: ${successCount} passed, ${failCount} failed`);
  return failCount === 0;
}

async function runTests() {
  console.log("🔒 Starting Non-Admin Access Tests");
  console.log("📍 Base URL:", BASE_URL);
  console.log("=" .repeat(60));

  let allPassed = true;

  if (!(await testAuthentication())) {
    console.error("\n❌ Cannot proceed without all accounts");
    console.log("\n💡 Run this command to create test accounts:");
    console.log("   npx tsx scripts/seed-test-accounts.ts");
    process.exit(1);
  }

  if (!(await testAdminAccess())) {
    allPassed = false;
  }

  if (!(await testTeacherAccessToAdminEndpoints())) {
    allPassed = false;
    console.error("\n🚨 CRITICAL: Teacher can access admin endpoints!");
  }

  if (!(await testStudentAccessToAdminEndpoints())) {
    allPassed = false;
    console.error("\n🚨 CRITICAL: Student can access admin endpoints!");
  }

  if (!(await testTeacherCRUDAttempts())) {
    allPassed = false;
    console.error("\n🚨 CRITICAL: Teacher can perform CRUD operations!");
  }

  if (!(await testAuthEndpointsForAllRoles())) {
    allPassed = false;
  }

  console.log("\n" + "=".repeat(60));
  if (allPassed) {
    console.log("✅ All authorization tests passed!");
    console.log("🔒 Security is properly enforced:");
    console.log("   - Admin can access all admin endpoints");
    console.log("   - Teacher CANNOT access admin endpoints (403)");
    console.log("   - Student CANNOT access admin endpoints (403)");
    console.log("   - All roles can access auth endpoints");
  } else {
    console.log("❌ Some authorization tests failed");
    console.log("🚨 SECURITY VULNERABILITIES DETECTED!");
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
