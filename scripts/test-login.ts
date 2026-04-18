/**
 * Login API Test Script
 * Tests all login scenarios including success and error cases
 */

interface TestCase {
    name: string;
    email: string;
    password: string;
    expectedStatus: number;
    expectedCode?: string;
}

const testCases: TestCase[] = [
    // Success cases
    {
        name: "Student login with valid credentials",
        email: "2251172560@e.tlu.edu.vn",
        password: "123456",
        expectedStatus: 200,
    },
    {
        name: "Teacher login with valid credentials",
        email: "kieutuandung@tlu.edu.vn",
        password: "123456",
        expectedStatus: 200,
    },
    {
        name: "Admin login with valid credentials",
        email: "admin@tlu.edu.vn",
        password: "123456",
        expectedStatus: 200,
    },
    // Error cases
    {
        name: "Login with unsupported email domain",
        email: "test@gmail.com",
        password: "123456",
        expectedStatus: 400,
        expectedCode: "UNSUPPORTED_EMAIL_DOMAIN",
    },
    {
        name: "Login with invalid email format",
        email: "notanemail",
        password: "123456",
        expectedStatus: 400,
        expectedCode: "VALIDATION_ERROR",
    },
    {
        name: "Login with missing email",
        email: "",
        password: "123456",
        expectedStatus: 400,
        expectedCode: "VALIDATION_ERROR",
    },
    {
        name: "Login with missing password",
        email: "admin@tlu.edu.vn",
        password: "",
        expectedStatus: 400,
        expectedCode: "VALIDATION_ERROR",
    },
    {
        name: "Login with non-existent account",
        email: "nonexistent@tlu.edu.vn",
        password: "123456",
        expectedStatus: 401,
        expectedCode: "INVALID_CREDENTIALS",
    },
    {
        name: "Login with wrong password",
        email: "admin@tlu.edu.vn",
        password: "wrongpassword",
        expectedStatus: 401,
        expectedCode: "INVALID_CREDENTIALS",
    },
];

async function runTests() {
    console.log("🧪 Testing Login API\n");
    console.log("=" .repeat(60));

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        try {
            const response = await fetch("http://localhost:3000/api/v1/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: testCase.email,
                    password: testCase.password,
                }),
            });

            const data = await response.json();
            const statusMatch = response.status === testCase.expectedStatus;
            const codeMatch = testCase.expectedCode
                ? data.error?.code === testCase.expectedCode
                : true;

            if (statusMatch && codeMatch) {
                console.log(`✓ ${testCase.name}`);
                console.log(`  Status: ${response.status}`);
                if (testCase.expectedStatus === 200) {
                    console.log(`  User: ${data.user.email} (${data.user.role})`);
                    console.log(`  Token: ${data.accessToken.substring(0, 30)}...`);
                } else {
                    console.log(`  Error: ${data.error.code} - ${data.error.message}`);
                }
                passed++;
            } else {
                console.log(`✗ ${testCase.name}`);
                console.log(`  Expected status: ${testCase.expectedStatus}, got: ${response.status}`);
                if (testCase.expectedCode) {
                    console.log(
                        `  Expected code: ${testCase.expectedCode}, got: ${data.error?.code}`,
                    );
                }
                failed++;
            }
        } catch (error) {
            console.log(`✗ ${testCase.name}`);
            console.log(`  Error: ${error}`);
            failed++;
        }
        console.log("");
    }

    console.log("=" .repeat(60));
    console.log(`\nResults: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
