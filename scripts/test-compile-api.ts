/**
 * Compile API Smoke Test
 * Tests the complete compile flow: create project → create file → compile → download PDF
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const TEST_EMAIL = "2251172560@e.tlu.edu.vn";
const TEST_PASSWORD = "123456";

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];
let authToken = "";
let testProjectId = "";
let testJobId = "";

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
  token?: string,
  expectBinary = false
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

  if (expectBinary) {
    const buffer = await response.arrayBuffer();
    return {
      status: response.status,
      data: buffer,
      contentType: response.headers.get("content-type"),
    };
  }

  const data = await response.text();
  const jsonData = data ? JSON.parse(data) : null;

  return {
    status: response.status,
    data: jsonData,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("COMPILE API SMOKE TEST");
  console.log("=".repeat(60));
  console.log("");

  // ===== STEP 1: AUTHENTICATION =====
  await test("Step 1: Login to get auth token", async () => {
    const result = await apiRequest("POST", "/api/v1/auth/login", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (result.status !== 200 || !result.data?.accessToken) {
      throw new Error(`Login failed: ${result.status}`);
    }

    authToken = result.data.accessToken;
    console.log(`  User: ${result.data.user.email} (${result.data.user.role})`);
  });

  // ===== STEP 2: CREATE PROJECT =====
  await test("Step 2: Create test project", async () => {
    const timestamp = new Date().toISOString();
    const result = await apiRequest("POST", "/api/v1/projects", {
      title: `Compile Test ${timestamp}`,
      category: "thesis",
    });

    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}: ${JSON.stringify(result.data)}`);
    }

    if (!result.data?.id) {
      throw new Error("Missing project ID in response");
    }

    testProjectId = result.data.id;
    console.log(`  Project ID: ${testProjectId}`);
    console.log(`  Title: ${result.data.title}`);
  });

  // ===== STEP 3: CREATE TYPST FILE =====
  await test("Step 3: Create main.typ file", async () => {
    const typstContent = `= Xin Chào Thế Giới

Đây là tài liệu test compile flow.

== Phần 1: Giới Thiệu

Đây là phần giới thiệu của tài liệu.

== Phần 2: Nội Dung Chính

Đây là nội dung chính của tài liệu.

=== Mục 2.1

Nội dung mục 2.1.

=== Mục 2.2

Nội dung mục 2.2.

== Phần 3: Kết Luận

Đây là phần kết luận của tài liệu.
`;

    const result = await apiRequest(
      "POST",
      `/api/v1/projects/${testProjectId}/files`,
      { 
        path: "main.typ",
        kind: "typst",
        content: typstContent 
      }
    );

    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}: ${JSON.stringify(result.data)}`);
    }

    console.log(`  File path: ${result.data.path}`);
    console.log(`  File size: ${typstContent.length} bytes`);
  });

  // ===== STEP 4: GET PROJECT SETTINGS =====
  await test("Step 4: Get project settings (auto-created)", async () => {
    const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}/settings`);

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!result.data?.settings) {
      throw new Error("Missing settings in response");
    }

    console.log(`  Main path: ${result.data.settings.mainPath}`);
    console.log(`  Settings auto-created: ${result.data.settings.mainPath === "main.typ" ? "✓" : "✗"}`);
  });

  // ===== STEP 5: ENQUEUE COMPILE JOB =====
  await test("Step 5: Enqueue compile job", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/compile`, {
      entryPath: "main.typ",
    });

    if (result.status !== 202) {
      throw new Error(`Expected 202, got ${result.status}: ${JSON.stringify(result.data)}`);
    }

    if (!result.data?.job?.id) {
      throw new Error("Missing job ID in response");
    }

    testJobId = result.data.job.id;
    console.log(`  Job ID: ${testJobId}`);
    console.log(`  Initial status: ${result.data.job.status}`);
  });

  // ===== STEP 6: POLL JOB STATUS =====
  await test("Step 6: Wait for compilation to complete", async () => {
    const maxAttempts = 30;
    let attempt = 0;
    let jobStatus = "queued";

    while (attempt < maxAttempts && jobStatus !== "success" && jobStatus !== "failed") {
      await sleep(2000); // Wait 2 seconds
      attempt++;

      const result = await apiRequest("GET", `/api/v1/projects/${testProjectId}/compile/${testJobId}`);

      if (result.status !== 200) {
        throw new Error(`Failed to get job status: ${result.status}`);
      }

      jobStatus = result.data.job.status;
      console.log(`  Attempt ${attempt}/${maxAttempts} - Status: ${jobStatus}`);

      if (jobStatus === "success") {
        console.log(`  ✓ Compilation succeeded!`);
        console.log(`  Artifact ID: ${result.data.job.latestArtifactId}`);
        return;
      } else if (jobStatus === "failed") {
        console.log(`  ✗ Compilation failed!`);
        if (result.data.job.diagnostics && result.data.job.diagnostics.length > 0) {
          console.log(`  Diagnostics:`);
          result.data.job.diagnostics.forEach((diag: any) => {
            console.log(`    - [${diag.severity}] ${diag.message}`);
            if (diag.file) {
              console.log(`      File: ${diag.file} Line: ${diag.range?.start?.line}`);
            }
          });
        }
        throw new Error("Compilation failed with errors");
      }
    }

    if (jobStatus !== "success") {
      throw new Error(`Timeout: Job did not complete after ${maxAttempts} attempts (${maxAttempts * 2}s)`);
    }
  });

  // ===== STEP 7: DOWNLOAD PDF ARTIFACT =====
  await test("Step 7: Download PDF artifact", async () => {
    const result = await apiRequest(
      "GET",
      `/api/v1/projects/${testProjectId}/compile/${testJobId}/artifact`,
      undefined,
      undefined,
      true
    );

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!result.data || result.data.byteLength === 0) {
      throw new Error("PDF artifact is empty");
    }

    console.log(`  Content-Type: ${result.contentType}`);
    console.log(`  PDF size: ${result.data.byteLength} bytes`);

    // Verify it's a PDF (starts with %PDF)
    const pdfHeader = new Uint8Array(result.data.slice(0, 4));
    const headerString = String.fromCharCode(...pdfHeader);
    if (!headerString.startsWith("%PDF")) {
      throw new Error("Downloaded file is not a valid PDF");
    }

    console.log(`  ✓ Valid PDF file (header: ${headerString})`);
  });

  // ===== STEP 8: TEST ERROR CASES =====
  await test("Step 8a: Compile with non-existent entry path (should fail)", async () => {
    const result = await apiRequest("POST", `/api/v1/projects/${testProjectId}/compile`, {
      entryPath: "nonexistent.typ",
    });

    if (result.status !== 202) {
      throw new Error(`Expected 202, got ${result.status}`);
    }

    const failJobId = result.data.job.id;

    // Wait for it to fail
    await sleep(3000);

    const statusResult = await apiRequest("GET", `/api/v1/projects/${testProjectId}/compile/${failJobId}`);

    if (statusResult.data.job.status !== "failed") {
      throw new Error(`Expected job to fail, but got status: ${statusResult.data.job.status}`);
    }

    console.log(`  ✓ Job correctly failed for non-existent file`);
    console.log(`  Diagnostics: ${statusResult.data.job.diagnostics.length} error(s)`);
  });

  await test("Step 8b: Get artifact for non-existent job (404)", async () => {
    const fakeJobId = "00000000-0000-0000-0000-000000000000";
    const result = await apiRequest(
      "GET",
      `/api/v1/projects/${testProjectId}/compile/${fakeJobId}/artifact`
    );

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  ✓ Correctly returned 404 for non-existent job`);
  });

  await test("Step 8c: Compile without auth token (401)", async () => {
    const result = await apiRequest(
      "POST",
      `/api/v1/projects/${testProjectId}/compile`,
      { entryPath: "main.typ" },
      ""
    );

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  ✓ Correctly rejected unauthorized request`);
  });

  // ===== STEP 9: CLEANUP =====
  await test("Step 9: Cleanup - Delete test project", async () => {
    const result = await apiRequest("DELETE", `/api/v1/projects/${testProjectId}`);

    if (result.status !== 204) {
      throw new Error(`Expected 204, got ${result.status}`);
    }

    console.log(`  ✓ Test project deleted: ${testProjectId}`);
  });

  // ===== SUMMARY =====
  console.log("");
  console.log("=".repeat(60));
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

  console.log("\n✅ ALL COMPILE API TESTS PASSED");
  console.log("=".repeat(60));
  console.log("");
  console.log("Summary:");
  console.log(`  - Project created: ${testProjectId}`);
  console.log(`  - Compile job: ${testJobId}`);
  console.log(`  - PDF generated and verified`);
  console.log(`  - All error cases handled correctly`);
  console.log("");
}

runTests().catch((error) => {
  console.error("Test runner failed:", error);
  process.exit(1);
});
