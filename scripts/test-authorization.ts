
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

const ADMIN_EMAIL = "admin@tlu.edu.vn";
const ADMIN_PASSWORD = "123456";


let adminToken = "";

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

async function loginAsAdmin() {
  console.log("\n=== Logging in as Admin ===");

  const result = await apiRequest("POST", "/api/v1/auth/login", undefined, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (result.data?.accessToken) {
    adminToken = result.data.accessToken;
    console.log(`✅ Admin login successful`);
    console.log(`   User: ${result.data.user.email} (${result.data.user.role})`);
    return true;
  } else {
    console.error("❌ Admin login failed");
    return false;
  }
}

async function testAdminAccessWithAdminToken() {
  console.log("\n=== Testing Admin Access with Admin Token ===");

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

async function testAdminAccessWithoutToken() {
  console.log("\n=== Testing Admin Access without Token ===");

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
    const result = await apiRequest(endpoint.method, endpoint.path);

    if (!result.ok && result.status === 401) {
      console.log(`✅ ${endpoint.desc}: Correctly rejected (401 Unauthorized)`);
      successCount++;
    } else {
      console.error(`❌ ${endpoint.desc}: Should be rejected but got (${result.status})`);
      console.error(`   Response:`, result.data);
      failCount++;
    }
  }

  console.log(`\n📊 No Token Results: ${successCount} passed, ${failCount} failed`);
  return failCount === 0;
}

async function testAuthEndpoints() {
  console.log("\n=== Testing Auth Endpoints (should work with any authenticated user) ===");

  const endpoints = [
    { method: "GET", path: "/api/v1/auth/me", desc: "Get Current User" },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const endpoint of endpoints) {
    const result = await apiRequest(endpoint.method, endpoint.path, adminToken);

    if (result.ok && result.status === 200) {
      console.log(`✅ ${endpoint.desc}: Access granted (200)`);
      successCount++;
    } else {
      console.error(`❌ ${endpoint.desc}: Failed (${result.status})`);
      console.error(`   Error:`, result.data);
      failCount++;
    }
  }

  console.log(`\n📊 Auth Endpoints Results: ${successCount} passed, ${failCount} failed`);
  return failCount === 0;
}

async function runTests() {
  console.log("🚀 Starting Authorization Tests");
  console.log(`📍 Base URL: ${BASE_URL}`);

  let allPassed = true;

  if (!(await loginAsAdmin())) {
    console.error("\n❌ Cannot proceed without admin login");
    process.exit(1);
  }

  if (!(await testAdminAccessWithAdminToken())) {
    allPassed = false;
  }

  if (!(await testAdminAccessWithoutToken())) {
    allPassed = false;
  }

  if (!(await testAuthEndpoints())) {
    allPassed = false;
  }

  console.log("\n" + "=".repeat(60));
  if (allPassed) {
    console.log("✅ All authorization tests passed!");
  } else {
    console.log("❌ Some authorization tests failed");
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
