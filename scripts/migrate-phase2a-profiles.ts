import { PrismaClient } from '../src/generated/prisma/client.js';

interface MigrationStats {
  teachersProcessed: number;
  teachersCreated: number;
  studentsProcessed: number;
  studentsCreated: number;
  errors: Array<{ type: string; message: string; record?: any }>;
}

async function migratePhase2a() {
  const prisma = new PrismaClient();
  const stats: MigrationStats = {
    teachersProcessed: 0,
    teachersCreated: 0,
    studentsProcessed: 0,
    studentsCreated: 0,
    errors: []
  };

  try {
    console.log('=== Phase 2a Migration: Teacher and Student Profiles ===\n');

    // Step 0: Rename legacy tables using raw SQL
    console.log('Step 0: Renaming legacy tables...');
    await prisma.$executeRaw`ALTER TABLE "Teacher" RENAME TO "Teacher_Legacy"`;
    await prisma.$executeRaw`ALTER TABLE "Student" RENAME TO "Student_Legacy"`;
    console.log('✅ Legacy tables renamed\n');

    await prisma.$transaction(async (tx) => {
      // Step 1: Preload all Department mappings (avoid N+1)
      console.log('Step 1: Preloading Department mappings...');
      const departments = await tx.department.findMany({
        select: { id: true, name: true }
      });
      const departmentMap = new Map(departments.map(d => [d.name, d.id]));
      console.log(`✅ Loaded ${departments.length} departments\n`);

      // Step 2: Preload all AcademicClass mappings (avoid N+1)
      console.log('Step 2: Preloading AcademicClass mappings...');
      const classes = await tx.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id, name FROM "AcademicClass"
      `;
      const classMap = new Map(classes.map(c => [c.name, c.id]));
      console.log(`✅ Loaded ${classes.length} classes\n`);

      // Step 3: Migrate Teacher_Legacy → Teacher
      console.log('Step 3: Migrating Teacher records...');
      const legacyTeachers = await tx.$queryRaw<Array<{
        userId: string;
        teacherCode: string | null;
        fullName: string | null;
        department: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>>`SELECT * FROM "Teacher_Legacy"`;
      
      console.log(`Found ${legacyTeachers.length} legacy teachers`);

      for (const legacy of legacyTeachers) {
        stats.teachersProcessed++;

        // Validate userId
        if (!legacy.userId) {
          stats.errors.push({
            type: 'TEACHER_NULL_USERID',
            message: 'Teacher record has NULL userId',
            record: legacy
          });
          throw new Error(`MIGRATION FAILED: Teacher record has NULL userId`);
        }

        // Lookup departmentId
        const departmentId = legacy.department ? departmentMap.get(legacy.department) : null;
        if (!departmentId) {
          stats.errors.push({
            type: 'TEACHER_DEPARTMENT_NOT_FOUND',
            message: `Department "${legacy.department}" not found for teacher ${legacy.userId}`,
            record: legacy
          });
          throw new Error(`MIGRATION FAILED: Department "${legacy.department}" not found for teacher ${legacy.userId}`);
        }

        // Create new Teacher record
        await tx.$executeRaw`
          INSERT INTO "Teacher" (
            id, "accountId", "teacherCode", "fullName", "departmentId", 
            "academicRank", "academicDegree", phone, "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(),
            ${legacy.userId},
            ${legacy.teacherCode || `TEMP_${legacy.userId}`},
            ${legacy.fullName || 'Chưa xác định'},
            ${departmentId},
            'Chưa xác định',
            'Chưa xác định',
            ${legacy.phone},
            ${legacy.createdAt},
            ${legacy.updatedAt}
          )
        `;
        
        stats.teachersCreated++;
      }
      console.log(`✅ Created ${stats.teachersCreated} Teacher records\n`);

      // Step 4: Migrate Student_Legacy → Student
      console.log('Step 4: Migrating Student records...');
      const legacyStudents = await tx.$queryRaw<Array<{
        userId: string;
        studentCode: string | null;
        fullName: string | null;
        className: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>>`SELECT * FROM "Student_Legacy"`;
      
      console.log(`Found ${legacyStudents.length} legacy students`);

      for (const legacy of legacyStudents) {
        stats.studentsProcessed++;

        // Validate userId
        if (!legacy.userId) {
          stats.errors.push({
            type: 'STUDENT_NULL_USERID',
            message: 'Student record has NULL userId',
            record: legacy
          });
          throw new Error(`MIGRATION FAILED: Student record has NULL userId`);
        }

        // Lookup classId
        const classId = legacy.className ? classMap.get(legacy.className) : null;
        if (!classId) {
          stats.errors.push({
            type: 'STUDENT_CLASS_NOT_FOUND',
            message: `Class "${legacy.className}" not found for student ${legacy.userId}`,
            record: legacy
          });
          throw new Error(`MIGRATION FAILED: Class "${legacy.className}" not found for student ${legacy.userId}`);
        }

        // Create new Student record
        await tx.$executeRaw`
          INSERT INTO "Student" (
            id, "accountId", "studentCode", "fullName", "classId", 
            phone, "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(),
            ${legacy.userId},
            ${legacy.studentCode || `TEMP_${legacy.userId}`},
            ${legacy.fullName || 'Chưa xác định'},
            ${classId},
            ${legacy.phone},
            ${legacy.createdAt},
            ${legacy.updatedAt}
          )
        `;
        
        stats.studentsCreated++;
      }
      console.log(`✅ Created ${stats.studentsCreated} Student records\n`);
    });

    // Step 5: Post-migration verification
    console.log('Step 5: Verifying migration...');
    
    const newTeacherCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Teacher"
    `;
    const newStudentCount = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Student"
    `;

    console.log(`\nMigration Statistics:`);
    console.log(`  Teachers processed: ${stats.teachersProcessed}`);
    console.log(`  Teachers created: ${stats.teachersCreated}`);
    console.log(`  Students processed: ${stats.studentsProcessed}`);
    console.log(`  Students created: ${stats.studentsCreated}`);
    console.log(`\nNew table counts:`);
    console.log(`  Teacher: ${newTeacherCount[0].count}`);
    console.log(`  Student: ${newStudentCount[0].count}`);

    // Verify counts match
    if (Number(newTeacherCount[0].count) !== stats.teachersCreated) {
      throw new Error(`Teacher count mismatch: expected ${stats.teachersCreated}, got ${newTeacherCount[0].count}`);
    }
    if (Number(newStudentCount[0].count) !== stats.studentsCreated) {
      throw new Error(`Student count mismatch: expected ${stats.studentsCreated}, got ${newStudentCount[0].count}`);
    }

    console.log('\n✅ Phase 2a migration completed successfully\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nErrors encountered:', stats.errors);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migratePhase2a();
