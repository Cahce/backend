import { PrismaClient } from '../src/generated/prisma/client.js';

async function verifyMigration() {
  const prisma = new PrismaClient();
  let allChecksPassed = true;

  try {
    console.log('=== Phase 2 Migration Verification ===\n');

    // 1. Row count reconciliation
    console.log('1. Verifying row counts...');
    const legacyTeacherCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Teacher_Legacy"
    `;
    const newTeacherCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Teacher"
    `;
    const legacyStudentCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Student_Legacy"
    `;
    const newStudentCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Student"
    `;

    console.log(`  Legacy Teacher: ${legacyTeacherCount[0].count}`);
    console.log(`  New Teacher: ${newTeacherCount[0].count}`);
    console.log(`  Legacy Student: ${legacyStudentCount[0].count}`);
    console.log(`  New Student: ${newStudentCount[0].count}`);

    if (legacyTeacherCount[0].count !== newTeacherCount[0].count) {
      console.log(`  ❌ Teacher count mismatch`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ Teacher counts match`);
    }

    if (legacyStudentCount[0].count !== newStudentCount[0].count) {
      console.log(`  ❌ Student count mismatch`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ Student counts match`);
    }

    // 2. accountId mapping verification
    console.log('\n2. Verifying accountId mappings...');
    const unmappedTeachers = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Teacher_Legacy" tl
      LEFT JOIN "Teacher" t ON tl."userId" = t."accountId"
      WHERE t.id IS NULL
    `;
    const unmappedStudents = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Student_Legacy" sl
      LEFT JOIN "Student" s ON sl."userId" = s."accountId"
      WHERE s.id IS NULL
    `;

    if (Number(unmappedTeachers[0].count) > 0) {
      console.log(`  ❌ Found ${unmappedTeachers[0].count} unmapped Teacher records`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ All Teacher records mapped`);
    }

    if (Number(unmappedStudents[0].count) > 0) {
      console.log(`  ❌ Found ${unmappedStudents[0].count} unmapped Student records`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ All Student records mapped`);
    }

    // 3. Required field verification
    console.log('\n3. Verifying required fields...');
    const teacherNulls = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Teacher"
      WHERE "teacherCode" IS NULL
         OR "fullName" IS NULL
         OR "departmentId" IS NULL
         OR "academicRank" IS NULL
         OR "academicDegree" IS NULL
    `;
    const studentNulls = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "Student"
      WHERE "studentCode" IS NULL
         OR "fullName" IS NULL
         OR "classId" IS NULL
    `;

    if (Number(teacherNulls[0].count) > 0) {
      console.log(`  ❌ Found ${teacherNulls[0].count} Teacher records with NULL required fields`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ All Teacher required fields populated`);
    }

    if (Number(studentNulls[0].count) > 0) {
      console.log(`  ❌ Found ${studentNulls[0].count} Student records with NULL required fields`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ All Student required fields populated`);
    }

    // 4. Duplicate verification
    console.log('\n4. Verifying uniqueness constraints...');
    const duplicateTeacherCodes = await prisma.$queryRaw<Array<{ teacherCode: string; count: bigint }>>`
      SELECT "teacherCode", COUNT(*) as count
      FROM "Teacher"
      GROUP BY "teacherCode"
      HAVING COUNT(*) > 1
    `;
    const duplicateStudentCodes = await prisma.$queryRaw<Array<{ studentCode: string; count: bigint }>>`
      SELECT "studentCode", COUNT(*) as count
      FROM "Student"
      GROUP BY "studentCode"
      HAVING COUNT(*) > 1
    `;
    const duplicateAccountIds = await prisma.$queryRaw<Array<{ accountId: string; count: bigint }>>`
      SELECT "accountId", COUNT(*) as count
      FROM (
        SELECT "accountId" FROM "Teacher" WHERE "accountId" IS NOT NULL
        UNION ALL
        SELECT "accountId" FROM "Student" WHERE "accountId" IS NOT NULL
      ) combined
      GROUP BY "accountId"
      HAVING COUNT(*) > 1
    `;

    if (duplicateTeacherCodes.length > 0) {
      console.log(`  ❌ Found ${duplicateTeacherCodes.length} duplicate teacherCode values`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ No duplicate teacherCode values`);
    }

    if (duplicateStudentCodes.length > 0) {
      console.log(`  ❌ Found ${duplicateStudentCodes.length} duplicate studentCode values`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ No duplicate studentCode values`);
    }

    if (duplicateAccountIds.length > 0) {
      console.log(`  ❌ Found ${duplicateAccountIds.length} duplicate accountId values`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ No duplicate accountId values`);
    }

    // 5. ProjectAdvisor reference verification (Phase 2b)
    console.log('\n5. Verifying ProjectAdvisor references...');
    const invalidAdvisorRefs = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "ProjectAdvisor" pa
      LEFT JOIN "Teacher" t ON pa."teacherId" = t.id
      WHERE t.id IS NULL
    `;

    if (Number(invalidAdvisorRefs[0].count) > 0) {
      console.log(`  ❌ Found ${invalidAdvisorRefs[0].count} ProjectAdvisor records with invalid Teacher references`);
      allChecksPassed = false;
    } else {
      console.log(`  ✅ All ProjectAdvisor references valid`);
    }

    // Final result
    console.log('\n=== Verification Results ===\n');
    if (allChecksPassed) {
      console.log('✅ All verification checks passed\n');
    } else {
      console.log('❌ Some verification checks failed\n');
    }

  } catch (error) {
    console.error('Verification error:', error);
    allChecksPassed = false;
  } finally {
    await prisma.$disconnect();
  }

  process.exit(allChecksPassed ? 0 : 1);
}

// Run verification
verifyMigration();
