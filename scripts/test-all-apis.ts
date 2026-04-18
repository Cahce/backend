/**
 * Comprehensive API Test Script
 * Tests all Phase 1 (Academic Structure) and Phase 2 (Teacher/Student Management) APIs
 */

import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

// Email format convention:
// - Admin: admin@tlu.edu.vn
// - Teacher: {teacherName}@tlu.edu.vn (e.g., kieutuandung@tlu.edu.vn)
// - Student: {studentId}@e.tlu.edu.vn (e.g., 2251172560@e.tlu.edu.vn)
const TEST_EMAIL = "admin@tlu.edu.vn";
const TEST_PASSWORD = "123456";

let authToken = "";
let createdIds: Record<string, string> = {};

// Helper function to make authenticated requests
async function apiRequest(
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {};

  if (authToken) {
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

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ ${method} ${path} failed:`, data);
      return { error: data, status: response.status };
    }

    return { data, status: response.status };
  } catch (error) {
    console.error(`❌ ${method} ${path} error:`, error);
    return { error, status: 0 };
  }
}

// Test authentication
async function testAuth() {
  console.log("\n=== Testing Authentication ===");

  const result = await apiRequest("POST", "/api/v1/auth/login", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (result.data?.accessToken) {
    authToken = result.data.accessToken;
    console.log("✅ Login successful");
    return true;
  } else {
    console.error("❌ Login failed");
    return false;
  }
}

// Test Faculty APIs
async function testFacultyAPIs() {
  console.log("\n=== Testing Faculty APIs ===");

  // Create Faculty
  console.log("\n1. POST /api/v1/admin/faculties - Create Faculty");
  const createResult = await apiRequest("POST", "/api/v1/admin/faculties", {
    name: "Khoa Công nghệ Thông tin",
    code: "CNTT",
  });

  if (createResult.data?.id) {
    createdIds.faculty = createResult.data.id;
    console.log(`✅ Created Faculty: ${createResult.data.name} (${createResult.data.id})`);
  } else {
    console.error("❌ Failed to create Faculty");
    return false;
  }

  // List Faculties
  console.log("\n2. GET /api/v1/admin/faculties - List Faculties");
  const listResult = await apiRequest("GET", "/api/v1/admin/faculties?page=1&pageSize=10");
  if (listResult.data?.items) {
    console.log(`✅ Listed ${listResult.data.items.length} faculties (total: ${listResult.data.total})`);
  }

  // Get Faculty by ID
  console.log("\n3. GET /api/v1/admin/faculties/:id - Get Faculty by ID");
  const getResult = await apiRequest("GET", `/api/v1/admin/faculties/${createdIds.faculty}`);
  if (getResult.data?.id) {
    console.log(`✅ Retrieved Faculty: ${getResult.data.name}`);
  }

  // Update Faculty
  console.log("\n4. PUT /api/v1/admin/faculties/:id - Update Faculty");
  const updateResult = await apiRequest("PUT", `/api/v1/admin/faculties/${createdIds.faculty}`, {
    name: "Khoa Công nghệ Thông tin (Updated)",
  });
  if (updateResult.data?.id) {
    console.log(`✅ Updated Faculty: ${updateResult.data.name}`);
  }

  // Search Faculty
  console.log("\n5. GET /api/v1/admin/faculties?search=công nghệ - Search Faculty");
  const searchResult = await apiRequest("GET", "/api/v1/admin/faculties?search=công nghệ");
  if (searchResult.data?.items) {
    console.log(`✅ Search found ${searchResult.data.items.length} faculties`);
  }

  return true;
}

// Test Department APIs
async function testDepartmentAPIs() {
  console.log("\n=== Testing Department APIs ===");

  // Create Department
  console.log("\n1. POST /api/v1/admin/departments - Create Department");
  const createResult = await apiRequest("POST", "/api/v1/admin/departments", {
    name: "Bộ môn Công nghệ Phần mềm",
    code: "CNPM",
    facultyId: createdIds.faculty,
  });

  if (createResult.data?.id) {
    createdIds.department = createResult.data.id;
    console.log(`✅ Created Department: ${createResult.data.name} (${createResult.data.id})`);
  } else {
    console.error("❌ Failed to create Department");
    return false;
  }

  // List Departments
  console.log("\n2. GET /api/v1/admin/departments - List Departments");
  const listResult = await apiRequest("GET", "/api/v1/admin/departments?page=1&pageSize=10");
  if (listResult.data?.items) {
    console.log(`✅ Listed ${listResult.data.items.length} departments (total: ${listResult.data.total})`);
  }

  // Get Department by ID (with Faculty context)
  console.log("\n3. GET /api/v1/admin/departments/:id - Get Department with Faculty context");
  const getResult = await apiRequest("GET", `/api/v1/admin/departments/${createdIds.department}`);
  if (getResult.data?.id && getResult.data?.faculty) {
    console.log(`✅ Retrieved Department: ${getResult.data.name} (Faculty: ${getResult.data.faculty.name})`);
  }

  // Filter by Faculty
  console.log("\n4. GET /api/v1/admin/departments?facultyId=X - Filter by Faculty");
  const filterResult = await apiRequest("GET", `/api/v1/admin/departments?facultyId=${createdIds.faculty}`);
  if (filterResult.data?.items) {
    console.log(`✅ Filtered ${filterResult.data.items.length} departments for faculty`);
  }

  return true;
}

// Test Major APIs
async function testMajorAPIs() {
  console.log("\n=== Testing Major APIs ===");

  // Create Major
  console.log("\n1. POST /api/v1/admin/majors - Create Major");
  const createResult = await apiRequest("POST", "/api/v1/admin/majors", {
    name: "Công nghệ Thông tin",
    code: "CNTT",
    facultyId: createdIds.faculty,
  });

  if (createResult.data?.id) {
    createdIds.major = createResult.data.id;
    console.log(`✅ Created Major: ${createResult.data.name} (${createResult.data.id})`);
  } else {
    console.error("❌ Failed to create Major");
    return false;
  }

  // List Majors
  console.log("\n2. GET /api/v1/admin/majors - List Majors");
  const listResult = await apiRequest("GET", "/api/v1/admin/majors?page=1&pageSize=10");
  if (listResult.data?.items) {
    console.log(`✅ Listed ${listResult.data.items.length} majors (total: ${listResult.data.total})`);
  }

  // Get Major by ID (with Faculty context)
  console.log("\n3. GET /api/v1/admin/majors/:id - Get Major with Faculty context");
  const getResult = await apiRequest("GET", `/api/v1/admin/majors/${createdIds.major}`);
  if (getResult.data?.id && getResult.data?.faculty) {
    console.log(`✅ Retrieved Major: ${getResult.data.name} (Faculty: ${getResult.data.faculty.name})`);
  }

  return true;
}

// Test Class APIs
async function testClassAPIs() {
  console.log("\n=== Testing Class APIs ===");

  // Create Class
  console.log("\n1. POST /api/v1/admin/classes - Create Class");
  const createResult = await apiRequest("POST", "/api/v1/admin/classes", {
    name: "Lớp CNTT K62",
    code: "CNTT-K62",
    majorId: createdIds.major,
  });

  if (createResult.data?.id) {
    createdIds.class = createResult.data.id;
    console.log(`✅ Created Class: ${createResult.data.name} (${createResult.data.id})`);
  } else {
    console.error("❌ Failed to create Class");
    return false;
  }

  // List Classes
  console.log("\n2. GET /api/v1/admin/classes - List Classes");
  const listResult = await apiRequest("GET", "/api/v1/admin/classes?page=1&pageSize=10");
  if (listResult.data?.items) {
    console.log(`✅ Listed ${listResult.data.items.length} classes (total: ${listResult.data.total})`);
  }

  // Get Class by ID (with Major and Faculty context)
  console.log("\n3. GET /api/v1/admin/classes/:id - Get Class with nested context");
  const getResult = await apiRequest("GET", `/api/v1/admin/classes/${createdIds.class}`);
  if (getResult.data?.id && getResult.data?.major && getResult.data?.faculty) {
    console.log(`✅ Retrieved Class: ${getResult.data.name}`);
    console.log(`   Major: ${getResult.data.major.name}, Faculty: ${getResult.data.faculty.name}`);
  }

  // Filter by Major
  console.log("\n4. GET /api/v1/admin/classes?majorId=X - Filter by Major");
  const filterMajorResult = await apiRequest("GET", `/api/v1/admin/classes?majorId=${createdIds.major}`);
  if (filterMajorResult.data?.items) {
    console.log(`✅ Filtered ${filterMajorResult.data.items.length} classes for major`);
  }

  // Filter by Faculty
  console.log("\n5. GET /api/v1/admin/classes?facultyId=X - Filter by Faculty (via Major)");
  const filterFacultyResult = await apiRequest("GET", `/api/v1/admin/classes?facultyId=${createdIds.faculty}`);
  if (filterFacultyResult.data?.items) {
    console.log(`✅ Filtered ${filterFacultyResult.data.items.length} classes for faculty`);
  }

  return true;
}

// Test Teacher APIs (Phase 2)
async function testTeacherAPIs() {
  console.log("\n=== Testing Teacher APIs (Phase 2) ===");

  // Create Teacher
  console.log("\n1. POST /api/v1/admin/teachers - Create Teacher");
  const createResult = await apiRequest("POST", "/api/v1/admin/teachers", {
    teacherCode: "GV001",
    fullName: "Nguyễn Văn A",
    departmentId: createdIds.department,
    academicRank: "Tiến sĩ",
    academicDegree: "Tiến sĩ",
    phone: "0912345678",
  });

  if (createResult.data?.id) {
    createdIds.teacher = createResult.data.id;
    console.log(`✅ Created Teacher: ${createResult.data.fullName} (${createResult.data.id})`);
  } else {
    console.error("❌ Failed to create Teacher");
    return false;
  }

  // List Teachers
  console.log("\n2. GET /api/v1/admin/teachers - List Teachers");
  const listResult = await apiRequest("GET", "/api/v1/admin/teachers?page=1&pageSize=10");
  if (listResult.data?.items) {
    console.log(`✅ Listed ${listResult.data.items.length} teachers (total: ${listResult.data.total})`);
  }

  // Get Teacher by ID (with Department and Faculty context)
  console.log("\n3. GET /api/v1/admin/teachers/:id - Get Teacher with context");
  const getResult = await apiRequest("GET", `/api/v1/admin/teachers/${createdIds.teacher}`);
  if (getResult.data?.id && getResult.data?.department && getResult.data?.faculty) {
    console.log(`✅ Retrieved Teacher: ${getResult.data.fullName}`);
    console.log(`   Department: ${getResult.data.department.name}, Faculty: ${getResult.data.faculty.name}`);
  }

  // Filter by Department
  console.log("\n4. GET /api/v1/admin/teachers?departmentId=X - Filter by Department");
  const filterDeptResult = await apiRequest("GET", `/api/v1/admin/teachers?departmentId=${createdIds.department}`);
  if (filterDeptResult.data?.items) {
    console.log(`✅ Filtered ${filterDeptResult.data.items.length} teachers for department`);
  }

  // Filter by Faculty
  console.log("\n5. GET /api/v1/admin/teachers?facultyId=X - Filter by Faculty");
  const filterFacultyResult = await apiRequest("GET", `/api/v1/admin/teachers?facultyId=${createdIds.faculty}`);
  if (filterFacultyResult.data?.items) {
    console.log(`✅ Filtered ${filterFacultyResult.data.items.length} teachers for faculty`);
  }

  // Filter by hasAccount
  console.log("\n6. GET /api/v1/admin/teachers?hasAccount=false - Filter by account status");
  const filterAccountResult = await apiRequest("GET", "/api/v1/admin/teachers?hasAccount=false");
  if (filterAccountResult.data?.items) {
    console.log(`✅ Filtered ${filterAccountResult.data.items.length} teachers without accounts`);
  }

  return true;
}

// Test Student APIs (Phase 2)
async function testStudentAPIs() {
  console.log("\n=== Testing Student APIs (Phase 2) ===");

  // Create Student
  console.log("\n1. POST /api/v1/admin/students - Create Student");
  const createResult = await apiRequest("POST", "/api/v1/admin/students", {
    studentCode: "SV001",
    fullName: "Trần Thị B",
    classId: createdIds.class,
    phone: "0987654321",
  });

  if (createResult.data?.id) {
    createdIds.student = createResult.data.id;
    console.log(`✅ Created Student: ${createResult.data.fullName} (${createResult.data.id})`);
  } else {
    console.error("❌ Failed to create Student");
    return false;
  }

  // List Students
  console.log("\n2. GET /api/v1/admin/students - List Students");
  const listResult = await apiRequest("GET", "/api/v1/admin/students?page=1&pageSize=10");
  if (listResult.data?.items) {
    console.log(`✅ Listed ${listResult.data.items.length} students (total: ${listResult.data.total})`);
  }

  // Get Student by ID (with Class, Major, and Faculty context)
  console.log("\n3. GET /api/v1/admin/students/:id - Get Student with nested context");
  const getResult = await apiRequest("GET", `/api/v1/admin/students/${createdIds.student}`);
  if (getResult.data?.id && getResult.data?.class && getResult.data?.major && getResult.data?.faculty) {
    console.log(`✅ Retrieved Student: ${getResult.data.fullName}`);
    console.log(`   Class: ${getResult.data.class.name}, Major: ${getResult.data.major.name}, Faculty: ${getResult.data.faculty.name}`);
  }

  // Filter by Class
  console.log("\n4. GET /api/v1/admin/students?classId=X - Filter by Class");
  const filterClassResult = await apiRequest("GET", `/api/v1/admin/students?classId=${createdIds.class}`);
  if (filterClassResult.data?.items) {
    console.log(`✅ Filtered ${filterClassResult.data.items.length} students for class`);
  }

  // Filter by Major
  console.log("\n5. GET /api/v1/admin/students?majorId=X - Filter by Major");
  const filterMajorResult = await apiRequest("GET", `/api/v1/admin/students?majorId=${createdIds.major}`);
  if (filterMajorResult.data?.items) {
    console.log(`✅ Filtered ${filterMajorResult.data.items.length} students for major`);
  }

  // Filter by Faculty
  console.log("\n6. GET /api/v1/admin/students?facultyId=X - Filter by Faculty");
  const filterFacultyResult = await apiRequest("GET", `/api/v1/admin/students?facultyId=${createdIds.faculty}`);
  if (filterFacultyResult.data?.items) {
    console.log(`✅ Filtered ${filterFacultyResult.data.items.length} students for faculty`);
  }

  return true;
}

// Test Update operations
async function testUpdateOperations() {
  console.log("\n=== Testing Update Operations ===");

  // Update Teacher
  console.log("\n1. PUT /api/v1/admin/teachers/:id - Update Teacher");
  const updateTeacherResult = await apiRequest("PUT", `/api/v1/admin/teachers/${createdIds.teacher}`, {
    fullName: "Nguyễn Văn A (Updated)",
    phone: "0999999999",
  });
  if (updateTeacherResult.data?.id) {
    console.log(`✅ Updated Teacher: ${updateTeacherResult.data.fullName}`);
  }

  // Update Student
  console.log("\n2. PUT /api/v1/admin/students/:id - Update Student");
  const updateStudentResult = await apiRequest("PUT", `/api/v1/admin/students/${createdIds.student}`, {
    fullName: "Trần Thị B (Updated)",
    phone: "0888888888",
  });
  if (updateStudentResult.data?.id) {
    console.log(`✅ Updated Student: ${updateStudentResult.data.fullName}`);
  }

  return true;
}

// Test Deletion Rules
async function testDeletionRules() {
  console.log("\n=== Testing Deletion Rules ===");

  // Try to delete Faculty with children (should fail)
  console.log("\n1. DELETE Faculty with children (should fail)");
  const deleteFacultyResult = await apiRequest("DELETE", `/api/v1/admin/faculties/${createdIds.faculty}`);
  if (deleteFacultyResult.error) {
    console.log(`✅ Correctly prevented deletion: ${deleteFacultyResult.error.error?.message || 'Has children'}`);
  } else {
    console.error("❌ Should have prevented deletion of Faculty with children");
  }

  // Try to delete Department with teachers (should fail)
  console.log("\n2. DELETE Department with teachers (should fail)");
  const deleteDeptResult = await apiRequest("DELETE", `/api/v1/admin/departments/${createdIds.department}`);
  if (deleteDeptResult.error) {
    console.log(`✅ Correctly prevented deletion: ${deleteDeptResult.error.error?.message || 'Has teachers'}`);
  } else {
    console.error("❌ Should have prevented deletion of Department with teachers");
  }

  // Try to delete Major with classes (should fail)
  console.log("\n3. DELETE Major with classes (should fail)");
  const deleteMajorResult = await apiRequest("DELETE", `/api/v1/admin/majors/${createdIds.major}`);
  if (deleteMajorResult.error) {
    console.log(`✅ Correctly prevented deletion: ${deleteMajorResult.error.error?.message || 'Has classes'}`);
  } else {
    console.error("❌ Should have prevented deletion of Major with classes");
  }

  // Try to delete Class with students (should fail)
  console.log("\n4. DELETE Class with students (should fail)");
  const deleteClassResult = await apiRequest("DELETE", `/api/v1/admin/classes/${createdIds.class}`);
  if (deleteClassResult.error) {
    console.log(`✅ Correctly prevented deletion: ${deleteClassResult.error.error?.message || 'Has students'}`);
  } else {
    console.error("❌ Should have prevented deletion of Class with students");
  }

  return true;
}

// Cleanup - delete in correct order
async function cleanup() {
  console.log("\n=== Cleanup (deleting in correct order) ===");

  // Delete Student first
  if (createdIds.student) {
    console.log("\n1. DELETE Student");
    const result = await apiRequest("DELETE", `/api/v1/admin/students/${createdIds.student}`);
    if (result.data) {
      console.log("✅ Deleted Student");
    }
  }

  // Delete Teacher
  if (createdIds.teacher) {
    console.log("\n2. DELETE Teacher");
    const result = await apiRequest("DELETE", `/api/v1/admin/teachers/${createdIds.teacher}`);
    if (result.data) {
      console.log("✅ Deleted Teacher");
    }
  }

  // Delete Class
  if (createdIds.class) {
    console.log("\n3. DELETE Class");
    const result = await apiRequest("DELETE", `/api/v1/admin/classes/${createdIds.class}`);
    if (result.data) {
      console.log("✅ Deleted Class");
    }
  }

  // Delete Major
  if (createdIds.major) {
    console.log("\n4. DELETE Major");
    const result = await apiRequest("DELETE", `/api/v1/admin/majors/${createdIds.major}`);
    if (result.data) {
      console.log("✅ Deleted Major");
    }
  }

  // Delete Department
  if (createdIds.department) {
    console.log("\n5. DELETE Department");
    const result = await apiRequest("DELETE", `/api/v1/admin/departments/${createdIds.department}`);
    if (result.data) {
      console.log("✅ Deleted Department");
    }
  }

  // Delete Faculty
  if (createdIds.faculty) {
    console.log("\n6. DELETE Faculty");
    const result = await apiRequest("DELETE", `/api/v1/admin/faculties/${createdIds.faculty}`);
    if (result.data) {
      console.log("✅ Deleted Faculty");
    }
  }
}

// Main test runner
async function runAllTests() {
  console.log("=".repeat(60));
  console.log("COMPREHENSIVE API TEST SUITE");
  console.log("Testing Phase 1 (Academic Structure) + Phase 2 (Teacher/Student)");
  console.log("=".repeat(60));

  try {
    // Authenticate
    const authSuccess = await testAuth();
    if (!authSuccess) {
      console.error("\n❌ Authentication failed. Aborting tests.");
      return;
    }

    // Phase 1 Tests
    await testFacultyAPIs();
    await testDepartmentAPIs();
    await testMajorAPIs();
    await testClassAPIs();

    // Phase 2 Tests
    await testTeacherAPIs();
    await testStudentAPIs();

    // Update Tests
    await testUpdateOperations();

    // Deletion Rules Tests
    await testDeletionRules();

    // Cleanup
    await cleanup();

    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL TESTS COMPLETED");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
  }
}

// Run tests
runAllTests();
