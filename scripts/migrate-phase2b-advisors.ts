import { PrismaClient } from '../src/generated/prisma/client.js';

interface MigrationStats {
  advisorsProcessed: number;
  advisorsUpdated: number;
  errors: Array<{ type: string; message: string; record?: any }>;
}

async function migratePhase2b() {
  const prisma = new PrismaClient();
  const stats: MigrationStats = {
    advisorsProcessed: 0,
    advisorsUpdated: 0,
    errors: []
  };

  try {
    console.log('=== Phase 2b Migration: ProjectAdvisor References ===\n');

    await prisma.$transaction(async (tx) => {
      // Step 1: Preload all Teacher accountId → id mappings (avoid N+1)
      console.log('Step 1: Preloading Teacher mappings...');
      const teachers = await tx.$queryRaw<Array<{ id: string; accountId: string }>>`
        SELECT id, "accountId" FROM "Teacher" WHERE "accountId" IS NOT NULL
      `;
      const teacherMap = new Map(teachers.map(t => [t.accountId, t.id]));
      console.log(`✅ Loaded ${teachers.length} teacher mappings\n`);

      // Step 2: Get all ProjectAdvisor records
      console.log('Step 2: Loading ProjectAdvisor records...');
      const advisors = await tx.$queryRaw<Array<{
        id: string;
        projectId: string;
        teacherId: string;
        isPrimary: boolean;
        createdAt: Date;
      }>>`SELECT * FROM "ProjectAdvisor"`;
      
      console.log(`Found ${advisors.length} project advisors\n`);

      // Step 3: Update all ProjectAdvisor.teacherId references
      console.log('Step 3: Updating ProjectAdvisor references...');
      
      for (const advisor of advisors) {
        stats.advisorsProcessed++;

        // Find new Teacher.id by accountId (which was old userId)
        const newTeacherId = teacherMap.get(advisor.teacherId);
        
        if (!newTeacherId) {
          stats.errors.push({
            type: 'ADVISOR_TEACHER_NOT_FOUND',
            message: `No Teacher found with accountId=${advisor.teacherId} for ProjectAdvisor ${advisor.id}`,
            record: advisor
          });
          throw new Error(`MIGRATION FAILED: No Teacher found with accountId=${advisor.teacherId} for ProjectAdvisor ${advisor.id}`);
        }

        // Update teacherId to new Teacher.id
        await tx.$executeRaw`
          UPDATE "ProjectAdvisor"
          SET "teacherId" = ${newTeacherId}
          WHERE id = ${advisor.id}
        `;
        
        stats.advisorsUpdated++;
      }
      
      console.log(`✅ Updated ${stats.advisorsUpdated} ProjectAdvisor records\n`);
    });

    // Step 4: Post-migration verification
    console.log('Step 4: Verifying migration...');
    
    // Verify all ProjectAdvisor.teacherId values reference valid Teacher.id
    const invalidReferences = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "ProjectAdvisor" pa
      LEFT JOIN "Teacher" t ON pa."teacherId" = t.id
      WHERE t.id IS NULL
    `;

    if (Number(invalidReferences[0].count) > 0) {
      throw new Error(`Found ${invalidReferences[0].count} ProjectAdvisor records with invalid Teacher references`);
    }

    console.log(`\nMigration Statistics:`);
    console.log(`  Advisors processed: ${stats.advisorsProcessed}`);
    console.log(`  Advisors updated: ${stats.advisorsUpdated}`);
    console.log(`  Invalid references: 0`);

    console.log('\n✅ Phase 2b migration completed successfully\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nErrors encountered:', stats.errors);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migratePhase2b();
