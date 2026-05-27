/**
 * Templates Public API Test
 * Tests the complete user flow: login → list templates → create project with template → verify files
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@tlu.edu.vn';
const ADMIN_PASSWORD = '123456';
const STUDENT_EMAIL = '2251172560@e.tlu.edu.vn';
const STUDENT_PASSWORD = '123456';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];
let adminToken = '';
let studentToken = '';
let testTemplateId = '';
let testVersionId = '';
let testProjectId = '';

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
): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
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
  console.log('='.repeat(60));
  console.log('TEMPLATES PUBLIC API TEST');
  console.log('='.repeat(60));
  console.log('');

  // ===== STEP 1: SETUP - LOGIN AS ADMIN =====
  await test('Step 1: Login as admin', async () => {
    const result = await apiRequest('POST', '/api/v1/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (result.status !== 200 || !result.data?.accessToken) {
      throw new Error(`Admin login failed: ${result.status}`);
    }

    adminToken = result.data.accessToken;
    console.log(`  Admin: ${result.data.user.email}`);
  });

  // ===== STEP 2: SETUP - CREATE TEMPLATE =====
  await test('Step 2: Create test template (admin)', async () => {
    const timestamp = new Date().toISOString();
    const result = await apiRequest(
      'POST',
      '/api/v1/admin/templates',
      {
        name: `Public Test Template ${timestamp}`,
        description: 'Template for public API testing',
        category: 'thesis',
        isOfficial: true,
      },
      adminToken,
    );

    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}`);
    }

    testTemplateId = result.data.id;
    console.log(`  Template ID: ${testTemplateId}`);
  });

  // ===== STEP 3: SETUP - UPLOAD VERSION =====
  await test('Step 3: Upload template version (admin)', async () => {
    const typstContent = `= Mẫu Luận Văn Tốt Nghiệp

#set page(numbering: "1")
#set heading(numbering: "1.1")

== Lời Cảm Ơn

Nội dung lời cảm ơn.

== Tóm Tắt

Nội dung tóm tắt.

== Chương 1: Giới Thiệu

Nội dung giới thiệu.

== Chương 2: Nội Dung Chính

Nội dung chính.

== Chương 3: Kết Luận

Nội dung kết luận.

== Tài Liệu Tham Khảo

Danh sách tài liệu tham khảo.
`;

    const formData = new FormData();
    const blob = new Blob([typstContent], { type: 'text/plain' });
    formData.append('file', blob, 'main.typ');
    formData.append('versionNumber', 'v1.0.0');
    formData.append('changelog', 'Initial public version');

    const response = await fetch(
      `${BASE_URL}/api/v1/admin/templates/${testTemplateId}/versions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      },
    );

    const data = await response.json();

    if (response.status !== 201) {
      throw new Error(`Expected 201, got ${response.status}`);
    }

    testVersionId = data.id;
    console.log(`  Version ID: ${testVersionId}`);
  });

  // ===== STEP 4: LOGIN AS STUDENT =====
  await test('Step 4: Login as student', async () => {
    const result = await apiRequest('POST', '/api/v1/auth/login', {
      email: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    });

    if (result.status !== 200 || !result.data?.accessToken) {
      throw new Error(`Student login failed: ${result.status}`);
    }

    studentToken = result.data.accessToken;
    console.log(`  Student: ${result.data.user.email}`);
  });

  // ===== STEP 5: LIST PUBLIC TEMPLATES =====
  await test('Step 5: List public templates (student)', async () => {
    const result = await apiRequest('GET', '/api/v1/templates', undefined, studentToken);

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!Array.isArray(result.data.templates)) {
      throw new Error('Expected templates array');
    }

    const foundTemplate = result.data.templates.find((t: any) => t.id === testTemplateId);
    if (!foundTemplate) {
      throw new Error('Test template not found in public list');
    }

    if (!foundTemplate.latestVersion) {
      throw new Error('Template should have latestVersion');
    }

    console.log(`  Total public templates: ${result.data.templates.length}`);
    console.log(`  Test template found with version: ${foundTemplate.latestVersion.versionNumber}`);
  });

  // ===== STEP 6: GET TEMPLATE BY ID =====
  await test('Step 6: Get template by ID (student)', async () => {
    const result = await apiRequest(
      'GET',
      `/api/v1/templates/${testTemplateId}`,
      undefined,
      studentToken,
    );

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (result.data.id !== testTemplateId) {
      throw new Error('Template ID mismatch');
    }

    console.log(`  Retrieved: ${result.data.name}`);
  });

  // ===== STEP 7: CREATE PROJECT WITH TEMPLATE =====
  await test('Step 7: Create project with template version', async () => {
    const timestamp = new Date().toISOString();
    const result = await apiRequest(
      'POST',
      '/api/v1/projects',
      {
        title: `Project from Template ${timestamp}`,
        category: 'thesis',
        templateVersionId: testVersionId,
      },
      studentToken,
    );

    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}: ${JSON.stringify(result.data)}`);
    }

    if (!result.data?.id) {
      throw new Error('Missing project ID in response');
    }

    testProjectId = result.data.id;
    console.log(`  Project ID: ${testProjectId}`);
    console.log(`  Title: ${result.data.title}`);
  });

  // ===== STEP 8: VERIFY PROJECT FILES =====
  await test('Step 8: Verify project files from template', async () => {
    const result = await apiRequest(
      'GET',
      `/api/v1/projects/${testProjectId}/files`,
      undefined,
      studentToken,
    );

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!Array.isArray(result.data)) {
      throw new Error('Expected files array');
    }

    if (result.data.length === 0) {
      throw new Error('Expected at least one file from template');
    }

    const mainFile = result.data.find((f: any) => f.path === 'main.typ');
    if (!mainFile) {
      throw new Error('main.typ not found in project files');
    }

    console.log(`  Files count: ${result.data.length}`);
    console.log(`  main.typ found: ${mainFile.path}`);
  });

  // ===== STEP 9: VERIFY PROJECT SETTINGS =====
  await test('Step 9: Verify project settings mainPath', async () => {
    const result = await apiRequest(
      'GET',
      `/api/v1/projects/${testProjectId}/settings`,
      undefined,
      studentToken,
    );

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!result.data?.settings) {
      throw new Error('Missing settings in response');
    }

    if (result.data.settings.mainPath !== 'main.typ') {
      throw new Error(`Expected mainPath to be 'main.typ', got '${result.data.settings.mainPath}'`);
    }

    console.log(`  mainPath: ${result.data.settings.mainPath}`);
  });

  // ===== STEP 10: READ FILE CONTENT =====
  await test('Step 10: Read main.typ content', async () => {
    const result = await apiRequest(
      'GET',
      `/api/v1/projects/${testProjectId}/files/main.typ`,
      undefined,
      studentToken,
    );

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!result.data?.content) {
      throw new Error('Missing file content');
    }

    if (!result.data.content.includes('Mẫu Luận Văn')) {
      throw new Error('File content does not match template');
    }

    console.log(`  Content length: ${result.data.content.length} bytes`);
    console.log(`  ✓ Content matches template`);
  });

  // ===== STEP 11: ERROR CASES =====
  await test('Step 11a: Create project with invalid template version (400)', async () => {
    const fakeVersionId = '00000000-0000-0000-0000-000000000000';
    const result = await apiRequest(
      'POST',
      '/api/v1/projects',
      {
        title: 'Invalid Template Project',
        category: 'thesis',
        templateVersionId: fakeVersionId,
      },
      studentToken,
    );

    if (result.status !== 400) {
      throw new Error(`Expected 400, got ${result.status}`);
    }

    console.log(`  ✓ Correctly rejected invalid template version`);
  });

  await test('Step 11b: Access templates without auth (401)', async () => {
    const result = await apiRequest('GET', '/api/v1/templates', undefined, '');

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  ✓ Correctly rejected unauthorized request`);
  });

  await test('Step 11c: Get inactive template (404)', async () => {
    // Deactivate template
    await apiRequest(
      'PATCH',
      `/api/v1/admin/templates/${testTemplateId}`,
      { isActive: false },
      adminToken,
    );

    const result = await apiRequest(
      'GET',
      `/api/v1/templates/${testTemplateId}`,
      undefined,
      studentToken,
    );

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  ✓ Correctly returned 404 for inactive template`);

    // Reactivate for cleanup
    await apiRequest(
      'PATCH',
      `/api/v1/admin/templates/${testTemplateId}`,
      { isActive: true },
      adminToken,
    );
  });

  // ===== STEP 12: CLEANUP =====
  await test('Step 12a: Cleanup - Delete project', async () => {
    const result = await apiRequest(
      'DELETE',
      `/api/v1/projects/${testProjectId}`,
      undefined,
      studentToken,
    );

    if (result.status !== 204) {
      throw new Error(`Expected 204, got ${result.status}`);
    }

    console.log(`  ✓ Project deleted: ${testProjectId}`);
  });

  await test('Step 12b: Cleanup - Delete template', async () => {
    const result = await apiRequest(
      'DELETE',
      `/api/v1/admin/templates/${testTemplateId}`,
      undefined,
      adminToken,
    );

    if (result.status !== 204) {
      throw new Error(`Expected 204, got ${result.status}`);
    }

    console.log(`  ✓ Template deleted: ${testTemplateId}`);
  });

  // ===== SUMMARY =====
  console.log('');
  console.log('='.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\nResults: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.name}: ${r.message}`));
    process.exit(1);
  }

  console.log('\n✅ ALL TEMPLATES PUBLIC API TESTS PASSED');
  console.log('='.repeat(60));
  console.log('');
  console.log('Summary:');
  console.log(`  - Template created: ${testTemplateId}`);
  console.log(`  - Version created: ${testVersionId}`);
  console.log(`  - Project created from template: ${testProjectId}`);
  console.log(`  - Files materialized and verified`);
  console.log('');
}

runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
