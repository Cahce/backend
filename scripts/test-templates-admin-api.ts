/**
 * Templates Admin API Test
 * Tests the complete admin flow: login → CRUD template → upload version
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@tlu.edu.vn';
const ADMIN_PASSWORD = '123456';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];
let authToken = '';
let testTemplateId = '';
let testVersionId = '';

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

  if (token !== undefined) {
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } else if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
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
  console.log('TEMPLATES ADMIN API TEST');
  console.log('='.repeat(60));
  console.log('');

  // ===== STEP 1: AUTHENTICATION =====
  await test('Step 1: Login as admin', async () => {
    const result = await apiRequest('POST', '/api/v1/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (result.status !== 200 || !result.data?.accessToken) {
      throw new Error(`Login failed: ${result.status}`);
    }

    authToken = result.data.accessToken;
    console.log(`  User: ${result.data.user.email} (${result.data.user.role})`);
  });

  // ===== STEP 2: CREATE TEMPLATE =====
  await test('Step 2: Create new template', async () => {
    const timestamp = new Date().toISOString();
    const result = await apiRequest('POST', '/api/v1/admin/templates', {
      name: `Test Template ${timestamp}`,
      description: 'Template for API testing',
      category: 'thesis',
      isOfficial: false,
    });

    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}: ${JSON.stringify(result.data)}`);
    }

    if (!result.data?.id) {
      throw new Error('Missing template ID in response');
    }

    testTemplateId = result.data.id;
    console.log(`  Template ID: ${testTemplateId}`);
    console.log(`  Name: ${result.data.name}`);
  });

  // ===== STEP 3: GET TEMPLATE BY ID =====
  await test('Step 3: Get template by ID', async () => {
    const result = await apiRequest('GET', `/api/v1/admin/templates/${testTemplateId}`);

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (result.data.id !== testTemplateId) {
      throw new Error('Template ID mismatch');
    }

    console.log(`  Retrieved: ${result.data.name}`);
  });

  // ===== STEP 4: LIST TEMPLATES =====
  await test('Step 4: List all templates', async () => {
    const result = await apiRequest('GET', '/api/v1/admin/templates?page=1&pageSize=10');

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!Array.isArray(result.data.templates)) {
      throw new Error('Expected templates array');
    }

    console.log(`  Total templates: ${result.data.total}`);
    console.log(`  Returned: ${result.data.templates.length}`);
  });

  // ===== STEP 5: UPDATE TEMPLATE =====
  await test('Step 5: Update template', async () => {
    const result = await apiRequest('PATCH', `/api/v1/admin/templates/${testTemplateId}`, {
      name: 'Updated Test Template',
      description: 'Updated description',
    });

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (result.data.name !== 'Updated Test Template') {
      throw new Error('Template name not updated');
    }

    console.log(`  Updated name: ${result.data.name}`);
  });

  // ===== STEP 6: UPLOAD TEMPLATE VERSION (.typ) =====
  await test('Step 6: Upload template version (.typ file)', async () => {
    const typstContent = `= Mẫu Luận Văn

== Giới Thiệu

Đây là nội dung mẫu của luận văn.

== Nội Dung Chính

Nội dung chính của luận văn.

== Kết Luận

Kết luận của luận văn.
`;

    // Create FormData for multipart upload
    const formData = new FormData();
    const blob = new Blob([typstContent], { type: 'text/plain' });
    formData.append('file', blob, 'main.typ');
    formData.append('versionNumber', 'v1.0.0');
    formData.append('changelog', 'Initial version');

    const response = await fetch(
      `${BASE_URL}/api/v1/admin/templates/${testTemplateId}/versions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      },
    );

    const data = await response.json();

    if (response.status !== 201) {
      throw new Error(`Expected 201, got ${response.status}: ${JSON.stringify(data)}`);
    }

    if (!data.id) {
      throw new Error('Missing version ID in response');
    }

    testVersionId = data.id;
    console.log(`  Version ID: ${testVersionId}`);
    console.log(`  Version: ${data.versionNumber}`);
  });

  // ===== STEP 7: LIST VERSIONS =====
  await test('Step 7: List template versions', async () => {
    const result = await apiRequest(
      'GET',
      `/api/v1/admin/templates/${testTemplateId}/versions`,
    );

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (!Array.isArray(result.data)) {
      throw new Error('Expected versions array');
    }

    if (result.data.length === 0) {
      throw new Error('Expected at least one version');
    }

    console.log(`  Versions count: ${result.data.length}`);
  });

  // ===== STEP 8: DEACTIVATE VERSION =====
  await test('Step 8: Deactivate template version', async () => {
    const result = await apiRequest(
      'PATCH',
      `/api/v1/admin/templates/${testTemplateId}/versions/${testVersionId}/deactivate`,
    );

    if (result.status !== 200) {
      throw new Error(`Expected 200, got ${result.status}`);
    }

    if (result.data.isActive !== false) {
      throw new Error('Version should be inactive');
    }

    console.log(`  Version deactivated: ${testVersionId}`);
  });

  // ===== STEP 9: ERROR CASES =====
  await test('Step 9a: Create template with duplicate name (should succeed)', async () => {
    const result = await apiRequest('POST', '/api/v1/admin/templates', {
      name: 'Updated Test Template',
      description: 'Duplicate name test',
      category: 'report',
      isOfficial: false,
    });

    // Duplicate names are allowed
    if (result.status !== 201) {
      throw new Error(`Expected 201, got ${result.status}`);
    }

    console.log(`  Duplicate name allowed: ${result.data.id}`);

    // Clean up
    await apiRequest('DELETE', `/api/v1/admin/templates/${result.data.id}`);
  });

  await test('Step 9b: Upload version with invalid version number (400)', async () => {
    const formData = new FormData();
    const blob = new Blob(['= Test'], { type: 'text/plain' });
    formData.append('file', blob, 'main.typ');
    formData.append('versionNumber', 'invalid-version');
    formData.append('changelog', 'Test');

    const response = await fetch(
      `${BASE_URL}/api/v1/admin/templates/${testTemplateId}/versions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      },
    );

    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}`);
    }

    console.log(`  ✓ Correctly rejected invalid version number`);
  });

  await test('Step 9c: Get non-existent template (404)', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const result = await apiRequest('GET', `/api/v1/admin/templates/${fakeId}`);

    if (result.status !== 404) {
      throw new Error(`Expected 404, got ${result.status}`);
    }

    console.log(`  ✓ Correctly returned 404 for non-existent template`);
  });

  await test('Step 9d: Access admin endpoint without auth (401)', async () => {
    const result = await apiRequest('GET', '/api/v1/admin/templates', undefined, '');

    if (result.status !== 401) {
      throw new Error(`Expected 401, got ${result.status}`);
    }

    console.log(`  ✓ Correctly rejected unauthorized request`);
  });

  // ===== STEP 10: DELETE TEMPLATE =====
  await test('Step 10: Delete template', async () => {
    const result = await apiRequest('DELETE', `/api/v1/admin/templates/${testTemplateId}`);

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

  console.log('\n✅ ALL TEMPLATES ADMIN API TESTS PASSED');
  console.log('='.repeat(60));
  console.log('');
}

runTests().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
