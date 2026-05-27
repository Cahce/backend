/**
 * Seed Templates Data
 * 
 * Seeds 3 official templates with initial versions.
 * Idempotent - can be run multiple times safely.
 */

import { PrismaClient } from '../../src/generated/prisma/client.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface TemplateData {
  name: string;
  description: string;
  category: string;
  assetPath: string;
  versionNumber: string;
  changelog: string;
}

const templates: TemplateData[] = [
  {
    name: 'Mẫu Luận Văn Khóa 2024',
    description: 'Mẫu luận văn tốt nghiệp chính thức cho sinh viên khóa 2024',
    category: 'thesis',
    assetPath: 'thesis-k2024',
    versionNumber: 'v1.0.0',
    changelog: 'Phiên bản đầu tiên',
  },
  {
    name: 'Mẫu Báo Cáo Thực Tập',
    description: 'Mẫu báo cáo thực tập tốt nghiệp',
    category: 'report',
    assetPath: 'internship-report',
    versionNumber: 'v1.0.0',
    changelog: 'Phiên bản đầu tiên',
  },
  {
    name: 'Mẫu Đề Cương Nghiên Cứu',
    description: 'Mẫu đề cương nghiên cứu khoa học',
    category: 'proposal',
    assetPath: 'research-proposal',
    versionNumber: 'v1.0.0',
    changelog: 'Phiên bản đầu tiên',
  },
];

async function seedTemplates() {
  console.log('🌱 Seeding templates...');

  for (const templateData of templates) {
    // Check if template already exists
    const existing = await prisma.template.findFirst({
      where: { name: templateData.name },
    });

    if (existing) {
      console.log(`  ⏭️  Template "${templateData.name}" already exists, skipping`);
      continue;
    }

    // Read template file content
    const assetDir = path.join(__dirname, 'template-assets', templateData.assetPath);
    const mainTypPath = path.join(assetDir, 'main.typ');

    let fileContent: string;
    try {
      fileContent = await fs.readFile(mainTypPath, 'utf-8');
    } catch (error) {
      console.error(`  ❌ Failed to read template file: ${mainTypPath}`);
      console.error(`     Error: ${error}`);
      continue;
    }

    // Create template
    const template = await prisma.template.create({
      data: {
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        isOfficial: true,
        isActive: true,
      },
    });

    console.log(`  ✅ Created template: ${template.name} (${template.id})`);

    // Create storage directory
    const storageRoot = process.env.TEMPLATE_STORAGE_DIR || './storage/templates';
    const storageKey = `${template.id}/seed-version`;
    const storageDir = path.join(storageRoot, storageKey);

    try {
      await fs.mkdir(storageDir, { recursive: true });
      await fs.writeFile(path.join(storageDir, 'main.typ'), fileContent, 'utf-8');
    } catch (error) {
      console.error(`  ❌ Failed to write template storage: ${storageDir}`);
      console.error(`     Error: ${error}`);
      // Rollback template creation
      await prisma.template.delete({ where: { id: template.id } });
      continue;
    }

    // Create version
    const version = await prisma.templateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: templateData.versionNumber,
        changelog: templateData.changelog,
        storageKey,
        entryPath: 'main.typ',
        isActive: true,
      },
    });

    console.log(`     ✅ Created version: ${version.versionNumber} (${version.id})`);
  }

  console.log('✅ Templates seeding complete');
}

export { seedTemplates };

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTemplates()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}
