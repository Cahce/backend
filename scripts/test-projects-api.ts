/**
 * Projects API Integration Test
 * Tests all project endpoints with comprehensive scenarios
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const TEST_EMAIL = "admin@tlu.edu.vn";
const TEST_PASSWORD = "123456";

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];
let authToken = "";
let testProjectId = "";

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, message: String(error) });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error}`);
  }
}

async function apiRequest(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {};

  if (token !== undefined) {
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } else if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.text();
  const jsonData = data ? JSON.parse(data) : null;

  return {
    status: response.status,
    data: jsonData,
  };
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("PROJECTS API INTEGRATION TEST");
  console.log("=".repeat(60));

  // ===== AUTHENTICATION =====
  await test("Login to get auth token", async () => {
    const result = await apiRequest("POST", "/api/v1/auth/login", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (result.status !== 200 || !result.data?.accessToken) {
      throw new Error(`Login failed: ${result.status}`);
    }

    authToken = result.data.accessToken;
    console.log(`  Token: ${authToken.substring(0, 30)}...`);
  });

  // ===== CREATE PROJECT - HAPPY PATH =====
  await test("POST /api/v1/projects - Create project (happy path)", async () => {
    const result = await apiRequest("POST", "/api/v1/projects", {
      title: "Test Project",
      category: "thesis",
    });

    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}: ${JSON.stringify(result.data)}`);
    }

    if (!result.data?.id || !result.data?.title) {
      throw new Error("Missing required fields in response");
    }

    testProjectId = result.data.id;
    console.log(`  Created project: ${result.data.title} (${testProjectId})`);
  });

  // ===== CREATE PROJECT - VALIDATION ERRORS =====
  await test("POST /api/v1/projects - Missing title (400)", async () => {
    const result = await apiRequest("POST", "/api/v1/projects", {
      category: "thesis",
    });

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  Correctly rejected: ${result.data?.error?.message || result.data?.error?.code}`);
  });

  await test("POST /api/v1/projects - Empty title (400)", async () => {
    const result = await apiRequest("POST", "/api/v1/projects", {
      title: "",
      category: "thesis",
    });

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  Correctly rejected: ${result.data?.error?.message || result.data?.error?.code}`);
  });

  await test("POST /api/v1/projects - Missing category (400)", async () => {
    const result = await apiRequest("POST", "/api/v1/projects", {
      title: "Test Project",
    });

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  Correctly rejected: ${result.data?.error?.message || result.data?.error?.code}`);
  });

  // ===== CREATE PROJECT - AUTH ERRORS =====
  await test("POST /api/v1/projects - No auth token (401)", async () => {
    const result = await apiRequest("POST", "/api/v1/projects", {
      title: "Unauthorized Project",
      category: "thesis",
    }, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  await test("POST /api/v1/projects - Invalid auth token (401)", async () => {
    const result = await apiRequest("POST", "/api/v1/projects", {
      title: "Invalid Token Project",
      category: "thesis",
    }, "invalid.token.here");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: invalid token`);
  });

  // ===== LIST PROJECTS - HAPPY PATH =====
  await test("GET /api/v1/projects - List projects (happy path)", async () => {
    const result = await apiRequest("GET", "/api/v1/projects");

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!Array.isArray(result.data?.projects)) {
      throw new Error("Expected projects array in response");
    }

    console.log(`  Found ${result.data.projects.length} projects`);
  });

  // ===== LIST PROJECTS - AUTH ERRORS =====
  await test("GET /api/v1/projects - No auth token (401)", async () => {
    const result = await apiRequest("GET", "/api/v1/projects", undefined, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== GET PROJECT BY ID - HAPPY PATH =====
  await test("GET /api/v1/projects/:id - Get project by ID (happy path)", async () => {
    const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}`);

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (result.data?.id !== testProjectId) {
      throw new Error("Project ID mismatch");
    }

    console.log(`  Retrieved: ${result.data.title}`);
  });

  // ===== GET PROJECT BY ID - NOT FOUND =====
  await test("GET /api/v1/projects/:id - Non-existent project (404)", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const result = await apiRequest("GET", `/api/v1/projects/${fakeId}`);

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent project`);
  });

  // ===== GET PROJECT BY ID - AUTH ERRORS =====
  await test("GET /api/v1/projects/:id - No auth token (401)", async () => {
    const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}`, undefined, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== UPDATE PROJECT - HAPPY PATH =====
  await test("PUT /api/v1/projects/:id - Update project (happy path)", async () => {
    const result = await apiRequest("PUT", `/api/v1/projects/${testProjectId}`, {
      title: "Updated Test Project",
      category: "report",
    });

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (result.data?.title !== "Updated Test Project") {
      throw new Error("Project title not updated");
    }

    console.log(`  Updated: ${result.data.title}`);
  });

  // ===== UPDATE PROJECT - VALIDATION ERRORS =====
  await test("PUT /api/v1/projects/:id - Empty title (400)", async () => {
    const result = await apiRequest("PUT", `/api/v1/projects/${testProjectId}`, {
      title: "",
    });

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  Correctly rejected: ${result.data?.error?.message || result.data?.error?.code}`);
  });

  // ===== UPDATE PROJECT - NOT FOUND =====
  await test("PUT /api/v1/projects/:id - Non-existent project (404)", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const result = await apiRequest("PUT", `/api/v1/projects/${fakeId}`, {
      title: "Updated Name",
    });

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent project`);
  });

  // ===== UPDATE PROJECT - AUTH ERRORS =====
  await test("PUT /api/v1/projects/:id - No auth token (401)", async () => {
    const result = await apiRequest("PUT", `/api/v1/projects/${testProjectId}`, {
      title: "Unauthorized Update",
    }, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== DELETE PROJECT - HAPPY PATH =====
  await test("DELETE /api/v1/projects/:id - Delete project (happy path)", async () => {
    const result = await apiRequest("DELETE", `/api/v1/projects/${testProjectId}`);

    if (result.status !== 204) {
      throw new Error(`Expected 204, got ${result.status}`);
    }

    console.log(`  Deleted project: ${testProjectId}`);
  });

  // ===== DELETE PROJECT - NOT FOUND =====
  await test("DELETE /api/v1/projects/:id - Already deleted (404)", async () => {
    const result = await apiRequest("DELETE", `/api/v1/projects/${testProjectId}`);

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for already deleted project`);
  });

  await test("DELETE /api/v1/projects/:id - Non-existent project (404)", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const result = await apiRequest("DELETE", `/api/v1/projects/${fakeId}`);

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent project`);
  });

  // ===== DELETE PROJECT - AUTH ERRORS =====
  await test("DELETE /api/v1/projects/:id - No auth token (401)", async () => {
    // Create a new project to delete
    const createResult = await apiRequest("POST", "/api/v1/projects", {
      title: "Project to Delete",
      category: "thesis",
    });
    const projectToDelete = createResult.data.id;

    const result = await apiRequest("DELETE", `/api/v1/projects/${projectToDelete}`, undefined, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    // Cleanup
    await apiRequest("DELETE", `/api/v1/projects/${projectToDelete}`);

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== SUMMARY =====
  console.log("\n" + "=".repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.name}: ${r.message}`));
    process.exit(1);
  }

  console.log("\n✅ ALL PROJECTS API TESTS PASSED");
  console.log("=".repeat(60));
}

runTests();
