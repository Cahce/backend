/**
 * Project Files API Integration Test
 * Tests all project file endpoints with comprehensive scenarios
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
  console.log("PROJECT FILES API INTEGRATION TEST");
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

  // ===== SETUP: CREATE TEST PROJECT =====
  await test("Setup: Create test project", async () => {
    const result = await apiRequest("POST", "/api/v1/projects", {
      title: "File Test Project",
      category: "thesis",
    });

    if (result.status !== 201) {
      throw new Error(`Failed to create project: ${result.status}`);
    }

    testProjectId = result.data.id;
    console.log(`  Created project: ${testProjectId}`);
  });

  // ===== CREATE FILE - HAPPY PATH =====
  await test("POST /api/v1/projects/:projectId/files - Create file (happy path)", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/files`, {
      path: "main.typ",
      kind: "typst",
      content: "#set page(paper: \"a4\")\n\n= Hello World\n\nThis is a test document.",
    });

    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}: ${JSON.stringify(result.data)}`);
    }

    if (!result.data?.id || result.data?.path !== "main.typ") {
      throw new Error("Missing or incorrect fields in response");
    }

    console.log(`  Created file: ${result.data.path} (${result.data.id})`);
  });

  await test("POST /api/v1/projects/:projectId/files - Create nested file", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/files`, {
      path: "chapters/chapter1.typ",
      kind: "typst",
      content: "= Chapter 1\n\nContent here.",
    });

    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}`);
    }

    console.log(`  Created nested file: ${result.data.path}`);
  });

  await test("POST /api/v1/projects/:projectId/files - Create bibliography file", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/files`, {
      path: "references.bib",
      kind: "bib",
      content: "@article{test2024,\n  title={Test Article},\n  author={Test Author},\n  year={2024}\n}",
    });

    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}`);
    }

    console.log(`  Created bib file: ${result.data.path}`);
  });

  // ===== CREATE FILE - VALIDATION ERRORS =====
  await test("POST /api/v1/projects/:projectId/files - Missing path (400)", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/files`, {
      kind: "typst",
      content: "No path provided",
    });

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  Correctly rejected: ${result.data?.error?.message || result.data?.error?.code}`);
  });

  await test("POST /api/v1/projects/:projectId/files - Missing kind (400)", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/files`, {
      path: "test.typ",
      content: "No kind provided",
    });

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  Correctly rejected: ${result.data?.error?.message || result.data?.error?.code}`);
  });

  await test("POST /api/v1/projects/:projectId/files - Missing content (400)", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/files`, {
      path: "test.typ",
      kind: "typst",
    });

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  Correctly rejected: ${result.data?.error?.message || result.data?.error?.code}`);
  });

  // ===== CREATE FILE - CONFLICT =====
  await test("POST /api/v1/projects/:projectId/files - Duplicate path (409)", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/files`, {
      path: "main.typ",
      kind: "typst",
      content: "Duplicate file",
    });

    if (result.status !== 409) {
      throw new Error(`Expected 409, got ${result.status}`);
    }

    console.log(`  Correctly rejected: file already exists`);
  });

  // ===== CREATE FILE - NOT FOUND =====
  await test("POST /api/v1/projects/:projectId/files - Non-existent project (404)", async () => {
    const fakeProjectId = "00000000-0000-0000-0000-000000000000";
    const result = await apiRequest("POST", `/api/v1/projects/${fakeProjectId}/files`, {
      path: "test.typ",
      kind: "typst",
      content: "Test",
    });

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent project`);
  });

  // ===== CREATE FILE - AUTH ERRORS =====
  await test("POST /api/v1/projects/:projectId/files - No auth token (401)", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/files`, {
      path: "unauthorized.typ",
      kind: "typst",
      content: "Test",
    }, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== LIST FILES - HAPPY PATH =====
  await test("GET /api/v1/projects/:projectId/files - List files (happy path)", async () => {
    const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}/files`);

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!Array.isArray(result.data?.files)) {
      throw new Error("Expected files array in response");
    }

    if (result.data.files.length < 3) {
      throw new Error(`Expected at least 3 files, got ${result.data.files.length}`);
    }

    console.log(`  Found ${result.data.files.length} files`);
  });

  // ===== LIST FILES - NOT FOUND =====
  await test("GET /api/v1/projects/:projectId/files - Non-existent project (404)", async () => {
    const fakeProjectId = "00000000-0000-0000-0000-000000000000";
    const result = await apiRequest("GET", `/api/v1/projects/${fakeProjectId}/files`);

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent project`);
  });

  // ===== LIST FILES - AUTH ERRORS =====
  await test("GET /api/v1/projects/:projectId/files - No auth token (401)", async () => {
    const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}/files`, undefined, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== GET FILE BY PATH - HAPPY PATH =====
  await test("GET /api/v1/projects/:projectId/files/*path - Get file (happy path)", async () => {
    const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}/files/main.typ`);

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (result.data?.path !== "main.typ" || !result.data?.content) {
      throw new Error("Missing or incorrect fields in response");
    }

    console.log(`  Retrieved file: ${result.data.path} (${result.data.content.length} chars)`);
  });

  await test("GET /api/v1/projects/:projectId/files/*path - Get nested file", async () => {
    const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}/files/chapters/chapter1.typ`);

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (result.data?.path !== "chapters/chapter1.typ") {
      throw new Error("Path mismatch");
    }

    console.log(`  Retrieved nested file: ${result.data.path}`);
  });

  // ===== GET FILE BY PATH - NOT FOUND =====
  await test("GET /api/v1/projects/:projectId/files/*path - Non-existent file (404)", async () => {
    const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}/files/nonexistent.typ`);

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent file`);
  });

  await test("GET /api/v1/projects/:projectId/files/*path - Non-existent project (404)", async () => {
    const fakeProjectId = "00000000-0000-0000-0000-000000000000";
    const result = await apiRequest("GET", `/api/v1/projects/${fakeProjectId}/files/main.typ`);

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent project`);
  });

  // ===== GET FILE BY PATH - AUTH ERRORS =====
  await test("GET /api/v1/projects/:projectId/files/*path - No auth token (401)", async () => {
    const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}/files/main.typ`, undefined, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== UPDATE FILE - HAPPY PATH =====
  await test("PUT /api/v1/projects/:projectId/files/*path - Update file (happy path)", async () => {
    const result = await apiRequest("PUT", `/api/v1/projects/${testProjectId}/files/main.typ`, {
      content: "#set page(paper: \"a4\")\n\n= Hello World (Updated)\n\nThis is an updated document.",
    });

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!result.data?.content?.includes("Updated")) {
      throw new Error("Content not updated");
    }

    console.log(`  Updated file: ${result.data.path}`);
  });

  // ===== UPDATE FILE - VALIDATION ERRORS =====
  await test("PUT /api/v1/projects/:projectId/files/*path - Missing content (400)", async () => {
    const result = await apiRequest("PUT", `/api/v1/projects/${testProjectId}/files/main.typ`, {});

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  Correctly rejected: ${result.data?.error?.message || result.data?.error?.code}`);
  });

  // ===== UPDATE FILE - NOT FOUND =====
  await test("PUT /api/v1/projects/:projectId/files/*path - Non-existent file (404)", async () => {
    const result = await apiRequest("PUT", `/api/v1/projects/${testProjectId}/files/nonexistent.typ`, {
      content: "Test",
    });

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent file`);
  });

  // ===== UPDATE FILE - AUTH ERRORS =====
  await test("PUT /api/v1/projects/:projectId/files/*path - No auth token (401)", async () => {
    const result = await apiRequest("PUT", `/api/v1/projects/${testProjectId}/files/main.typ`, {
      content: "Unauthorized update",
    }, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== RENAME FILE - HAPPY PATH =====
  await test("PATCH /api/v1/projects/:projectId/files:rename - Rename file (happy path)", async () => {
    const result = await apiRequest("PATCH", `/api/v1/projects/${testProjectId}/files:rename?path=chapters/chapter1.typ`, {
      newPath: "chapters/introduction.typ",
    });

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}: ${JSON.stringify(result.data)}`);
    }

    if (result.data?.path !== "chapters/introduction.typ") {
      throw new Error("Path not updated");
    }

    console.log(`  Renamed file: chapters/chapter1.typ → ${result.data.path}`);
  });

  // ===== RENAME FILE - VALIDATION ERRORS =====
  await test("PATCH /api/v1/projects/:projectId/files:rename - Missing newPath (400)", async () => {
    const result = await apiRequest("PATCH", `/api/v1/projects/${testProjectId}/files:rename?path=main.typ`, {});

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  Correctly rejected: ${result.data?.error?.message || result.data?.error?.code}`);
  });

  // ===== RENAME FILE - CONFLICT =====
  await test("PATCH /api/v1/projects/:projectId/files:rename - Duplicate newPath (409)", async () => {
    const result = await apiRequest("PATCH", `/api/v1/projects/${testProjectId}/files:rename?path=references.bib`, {
      newPath: "main.typ",
    });

    if (result.status !== 409) {
      throw new Error(`Expected 409, got ${result.status}`);
    }

    console.log(`  Correctly rejected: file already exists at newPath`);
  });

  // ===== RENAME FILE - NOT FOUND =====
  await test("PATCH /api/v1/projects/:projectId/files:rename - Non-existent file (404)", async () => {
    const result = await apiRequest("PATCH", `/api/v1/projects/${testProjectId}/files:rename?path=nonexistent.typ`, {
      newPath: "renamed.typ",
    });

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent file`);
  });

  // ===== RENAME FILE - AUTH ERRORS =====
  await test("PATCH /api/v1/projects/:projectId/files:rename - No auth token (401)", async () => {
    const result = await apiRequest("PATCH", `/api/v1/projects/${testProjectId}/files:rename?path=main.typ`, {
      newPath: "unauthorized.typ",
    }, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== DELETE FILE - HAPPY PATH =====
  await test("DELETE /api/v1/projects/:projectId/files/*path - Delete file (happy path)", async () => {
    const result = await apiRequest("DELETE", `/api/v1/projects/${testProjectId}/files/references.bib`);

    if (result.status !== 204) {
      throw new Error(`Expected 204, got ${result.status}`);
    }

    console.log(`  Deleted file: references.bib`);
  });

  // ===== DELETE FILE - NOT FOUND =====
  await test("DELETE /api/v1/projects/:projectId/files/*path - Already deleted (404)", async () => {
    const result = await apiRequest("DELETE", `/api/v1/projects/${testProjectId}/files/references.bib`);

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for already deleted file`);
  });

  await test("DELETE /api/v1/projects/:projectId/files/*path - Non-existent file (404)", async () => {
    const result = await apiRequest("DELETE", `/api/v1/projects/${testProjectId}/files/nonexistent.typ`);

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  Correctly returned 404 for non-existent file`);
  });

  // ===== DELETE FILE - AUTH ERRORS =====
  await test("DELETE /api/v1/projects/:projectId/files/*path - No auth token (401)", async () => {
    const result = await apiRequest("DELETE", `/api/v1/projects/${testProjectId}/files/main.typ`, undefined, "");

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  Correctly rejected: unauthorized`);
  });

  // ===== CLEANUP =====
  await test("Cleanup: Delete test project", async () => {
    const result = await apiRequest("DELETE", `/api/v1/projects/${testProjectId}`);

    if (result.status !== 204) {
      throw new Error(`Failed to delete project: ${result.status}`);
    }

    console.log(`  Deleted project: ${testProjectId}`);
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

  console.log("\n✅ ALL PROJECT FILES API TESTS PASSED");
  console.log("=".repeat(60));
}

runTests();
