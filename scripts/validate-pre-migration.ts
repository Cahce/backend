import { PrismaClient } from '../src/generated/prisma/client.js';

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

async function validatePreMigration(): Promise<ValidationResult> {
  const prisma = new PrismaClient();
  const result: ValidationResult = {
    passed: true,
    errors: [],
    warnings: []
  };

  try {
    console.log('=== Pre-Migration Validation ===\n');

    // 1. Check for null or duplicate userId in Teacher
    console.log('1. Validating Teacher.userId...');
    const teacherNullCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Teacher" WHERE "userId" IS NULL
    `;
    if (Number(teacherNullCount[0].count) > 0) {
      result.passed = false;
      result.errors.push(`Found ${teacherNullCount[0].count} Teacher records with NULL userId`);
    }

    const teacherDuplicates = await prisma.$queryRaw<Array<{ userId: string; count: bigint }>>`
      SELECT "userId", COUNT(*) as count 
      FROM "Teacher" 
      GROUP BY "userId" 
      HAVING COUNT(*) > 1
    `;
    if (teacherDuplicates.length > 0) {
      result.passed = false;
      result.errors.push(`Found ${teacherDuplicates.length} duplicate Teacher.userId values`);
      teacherDuplicates.forEach(dup => {
        result.errors.push(`  - userId ${dup.userId}: ${dup.count} records`);
      });
    }

    // 2. Check for null or duplicate userId in Student
    console.log('2. Validating Student.userId...');
    const studentNullCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Student" WHERE "userId" IS NULL
    `;
    if (Number(studentNullCount[0].count) > 0) {
      result.passed = false;
      result.errors.push(`Found ${studentNullCount[0].count} Student records with NULL userId`);
    }

    const studentDuplicates = await prisma.$queryRaw<Array<{ userId: string; count: bigint }>>`
      SELECT "userId", COUNT(*) as count 
      FROM "Student" 
      GROUP BY "userId" 
      HAVING COUNT(*) > 1
    `;
    if (studentDuplicates.length > 0) {
      result.passed = false;
      result.errors.push(`Found ${studentDuplicates.length} duplicate Student.userId values`);
      studentDuplicates.forEach(dup => {
        result.errors.push(`  - userId ${dup.userId}: ${dup.count} records`);
      });
    }

    // 3. Check for null required fields in Teacher
    console.log('3. Validating Teacher required fields...');
    const teacherNullFields = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count 
      FROM "Teacher" 
      WHERE "teacherCode" IS NULL OR "fullName" IS NULL
    `;
    if (Number(teacherNullFields[0].count) > 0) {
      result.warnings.push(`Found ${teacherNullFields[0].count} Teacher records with NULL teacherCode or fullName (will use defaults)`);
    }

    // 4. Check for null required fields in Student
    console.log('4. Validating Student required fields...');
    const studentNullFields = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count 
      FROM "Student" 
      WHERE "studentCode" IS NULL OR "fullName" IS NULL
    `;
    if (Number(studentNullFields[0].count) > 0) {
      result.warnings.push(`Found ${studentNullFields[0].count} Student records with NULL studentCode or fullName (will use defaults)`);
    }

    // 5. Check for duplicate teacherCode
    console.log('5. Validating Teacher.teacherCode uniqueness...');
    const teacherCodeDuplicates = await prisma.$queryRaw<Array<{ teacherCode: string; count: bigint }>>`
      SELECT "teacherCode", COUNT(*) as count 
      FROM "Teacher" 
      WHERE "teacherCode" IS NOT NULL
      GROUP BY "teacherCode" 
      HAVING COUNT(*) > 1
    `;
    if (teacherCodeDuplicates.length > 0) {
      result.passed = false;
      result.errors.push(`Found ${teacherCodeDuplicates.length} duplicate Teacher.teacherCode values`);
      teacherCodeDuplicates.forEach(dup => {
        result.errors.push(`  - teacherCode ${dup.teacherCode}: ${dup.count} records`);
      });
    }

    // 6. Check for duplicate studentCode
    console.log('6. Validating Student.studentCode uniqueness...');
    const studentCodeDuplicates = await prisma.$queryRaw<Array<{ studentCode: string; count: bigint }>>`
      SELECT "studentCode", COUNT(*) as count 
      FROM "Student" 
      WHERE "studentCode" IS NOT NULL
      GROUP BY "studentCode" 
      HAVING COUNT(*) > 1
    `;
    if (studentCodeDuplicates.length > 0) {
      result.passed = false;
      result.errors.push(`Found ${studentCodeDuplicates.length} duplicate Student.studentCode values`);
      studentCodeDuplicates.forEach(dup => {
        result.errors.push(`  - studentCode ${dup.studentCode}: ${dup.count} records`);
      });
    }

    // 7. Validate Department name uniqueness (if using name-based mapping)
    console.log('7. Validating Department.name uniqueness...');
    const departmentNameDuplicates = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
      SELECT "name", COUNT(*) as count 
      FROM "Department" 
      GROUP BY "name" 
      HAVING COUNT(*) > 1
    `;
    if (departmentNameDuplicates.length > 0) {
      result.passed = false;
      result.errors.push(`Found ${departmentNameDuplicates.length} duplicate Department.name values (cannot use name-based mapping)`);
      departmentNameDuplicates.forEach(dup => {
        result.errors.push(`  - name "${dup.name}": ${dup.count} records`);
      });
    }

    // 8. Validate AcademicClass name uniqueness (if using name-based mapping)
    console.log('8. Validating AcademicClass.name uniqueness...');
    const classNameDuplicates = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
      SELECT "name", COUNT(*) as count 
      FROM "AcademicClass" 
      GROUP BY "name" 
      HAVING COUNT(*) > 1
    `;
    if (classNameDuplicates.length > 0) {
      result.passed = false;
      result.errors.push(`Found ${classNameDuplicates.length} duplicate AcademicClass.name values (cannot use name-based mapping)`);
      classNameDuplicates.forEach(dup => {
        result.errors.push(`  - name "${dup.name}": ${dup.count} records`);
      });
    }

    // 9. Check row counts
    console.log('9. Recording baseline row counts...');
    const teacherCount = await prisma.teacher.count();
    const studentCount = await prisma.student.count();
    const advisorCount = await prisma.projectAdvisor.count();
    
    console.log(`\nBaseline counts:`);
    console.log(`  - Teacher: ${teacherCount}`);
    console.log(`  - Student: ${studentCount}`);
    console.log(`  - ProjectAdvisor: ${advisorCount}`);

    // Print results
    console.log('\n=== Validation Results ===\n');
    
    if (result.warnings.length > 0) {
      console.log('WARNINGS:');
      result.warnings.forEach(w => console.log(`  ⚠️  ${w}`));
      console.log('');
    }

    if (result.errors.length > 0) {
      console.log('ERRORS:');
      result.errors.forEach(e => console.log(`  ❌ ${e}`));
      console.log('');
    }

    if (result.passed) {
      console.log('✅ All validation checks passed. Safe to proceed with migration.\n');
    } else {
      console.log('❌ Validation failed. Fix errors before proceeding with migration.\n');
    }

  } catch (error) {
    result.passed = false;
    result.errors.push(`Validation script error: ${error}`);
    console.error('Validation error:', error);
  } finally {
    await prisma.$disconnect();
  }

  return result;
}

// Run validation
validatePreMigration().then(result => {
  process.exit(result.passed ? 0 : 1);
});
