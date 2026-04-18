/**
 * Comprehensive Auth API Test Script
 * Tests all authentication endpoints
 */

interface TestResult {
    name: string;
    passed: boolean;
    message?: string;
}

const results: TestResult[] = [];

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

async function runTests() {
    console.log("🧪 Testing Auth API\n");
    console.log("=".repeat(60));

    let accessToken = "";
    let userId = "";

    // Test 1: Login with valid credentials
    await test("Login with valid credentials (admin)", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "admin@tlu.edu.vn",
                password: "123456",
            }),
        });

        if (response.status !== 200) {
            throw new Error(`Expected 200, got ${response.status}`);
        }

        const data = await response.json();
        if (!data.accessToken || !data.user) {
            throw new Error("Missing accessToken or user in response");
        }

        accessToken = data.accessToken;
        userId = data.user.id;
        console.log(`  Token: ${accessToken.substring(0, 30)}...`);
        console.log(`  User: ${data.user.email} (${data.user.role})`);
    });

    // Test 2: Get current user
    await test("Get current user with valid token", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/me", {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.status !== 200) {
            throw new Error(`Expected 200, got ${response.status}`);
        }

        const data = await response.json();
        if (!data.user || data.user.id !== userId) {
            throw new Error("User data mismatch");
        }

        console.log(`  User: ${data.user.email} (${data.user.role})`);
    });

    // Test 3: Get current user without token
    await test("Get current user without token (should fail)", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/me", {
            method: "GET",
        });

        if (response.status !== 401) {
            throw new Error(`Expected 401, got ${response.status}`);
        }

        console.log(`  Correctly rejected: ${response.status}`);
    });

    // Test 4: Change password
    await test("Change password with valid old password", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/change-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                oldPassword: "123456",
                newPassword: "newpass123",
                confirmNewPassword: "newpass123",
            }),
        });

        if (response.status !== 200) {
            const error = await response.json();
            throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        console.log(`  ${data.message}`);
    });

    // Test 5: Login with new password
    await test("Login with new password", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "admin@tlu.edu.vn",
                password: "newpass123",
            }),
        });

        if (response.status !== 200) {
            throw new Error(`Expected 200, got ${response.status}`);
        }

        const data = await response.json();
        accessToken = data.accessToken;
        console.log(`  New token: ${accessToken.substring(0, 30)}...`);
    });

    // Test 6: Change password with wrong old password
    await test("Change password with wrong old password (should fail)", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/change-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                oldPassword: "wrongpassword",
                newPassword: "anotherpass",
                confirmNewPassword: "anotherpass",
            }),
        });

        if (response.status !== 400) {
            throw new Error(`Expected 400, got ${response.status}`);
        }

        const data = await response.json();
        console.log(`  Correctly rejected: ${data.error.message}`);
    });

    // Test 7: Change password with mismatched confirmation
    await test("Change password with mismatched confirmation (should fail)", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/change-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                oldPassword: "newpass123",
                newPassword: "anotherpass",
                confirmNewPassword: "differentpass",
            }),
        });

        if (response.status !== 400) {
            throw new Error(`Expected 400, got ${response.status}`);
        }

        const data = await response.json();
        console.log(`  Correctly rejected: ${data.error.message}`);
    });

    // Test 8: Change password to same as old (should fail)
    await test("Change password to same as old (should fail)", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/change-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                oldPassword: "newpass123",
                newPassword: "newpass123",
                confirmNewPassword: "newpass123",
            }),
        });

        if (response.status !== 400) {
            throw new Error(`Expected 400, got ${response.status}`);
        }

        const data = await response.json();
        console.log(`  Correctly rejected: ${data.error.message}`);
    });

    // Test 9: Logout
    await test("Logout and revoke token", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/logout", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: "{}",
        });

        if (response.status !== 200) {
            throw new Error(`Expected 200, got ${response.status}`);
        }

        const data = await response.json();
        console.log(`  ${data.message}`);
    });

    // Test 10: Use revoked token (should fail)
    await test("Use revoked token (should fail)", async () => {
        const response = await fetch("http://localhost:3000/api/v1/auth/me", {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.status !== 401) {
            throw new Error(`Expected 401, got ${response.status}`);
        }

        console.log(`  Correctly rejected: ${response.status}`);
    });

    // Reset password back to 123456 for next test run
    await test("Reset password back to 123456", async () => {
        // Login with new password
        const loginResponse = await fetch("http://localhost:3000/api/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "admin@tlu.edu.vn",
                password: "newpass123",
            }),
        });

        const loginData = await loginResponse.json();
        const newToken = loginData.accessToken;

        // Change password back
        const response = await fetch("http://localhost:3000/api/v1/auth/change-password", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${newToken}`,
            },
            body: JSON.stringify({
                oldPassword: "newpass123",
                newPassword: "123456",
                confirmNewPassword: "123456",
            }),
        });

        if (response.status !== 200) {
            throw new Error(`Expected 200, got ${response.status}`);
        }

        console.log(`  Password reset to 123456`);
    });

    console.log("\n" + "=".repeat(60));
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`\nResults: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
