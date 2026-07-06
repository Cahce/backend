import { PrismaClient } from '../src/generated/prisma/index.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import {
  buildTypstGraph,
  detectMainPath,
  isTypstSource,
  reachableFrom,
  type DetectFile,
} from '../src/modules/projects/application/detectMainPath.js';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const apply = process.argv.includes('--apply');
const projectFlagIdx = process.argv.indexOf('--project');
const onlyProjectId =
  projectFlagIdx >= 0 ? process.argv[projectFlagIdx + 1] ?? null : null;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function readToml(files: DetectFile[], name: string): string | null {
  const found = files.find(
    (file) => file.path === name || file.path.endsWith(`/${name}`),
  );
  return found?.content ?? null;
}

async function main(): Promise<void> {
  const projects = await prisma.project.findMany({
    where: onlyProjectId ? { id: onlyProjectId } : undefined,
    select: {
      id: true,
      title: true,
      settings: { select: { mainPath: true } },
      files: { select: { path: true, textContent: true } },
    },
  });

  const changes: Array<{
    id: string;
    title: string;
    from: string;
    to: string;
    reason: string;
  }> = [];
  let scanned = 0;
  let updated = 0;

  for (const project of projects) {
    scanned += 1;

    const detectFiles: DetectFile[] = project.files.map((file) => ({
      path: file.path,
      content: isTypstSource(file.path) ? file.textContent : null,
    }));
    if (detectFiles.length === 0) continue;

    const detected = detectMainPath(detectFiles, {
      typstToml: readToml(detectFiles, 'typst.toml'),
      projectToml: readToml(detectFiles, 'project.toml'),
    });
    if (!detected) continue;

    const current = project.settings?.mainPath ?? null;
    if (current === detected) continue;

    const pathSet = new Set(detectFiles.map((file) => file.path));
    let reason: string | null = null;
    if (current === null) {
      reason = 'no mainPath set';
    } else if (!pathSet.has(current)) {
      reason = 'current mainPath missing from project files';
    } else if (reachableFrom(buildTypstGraph(detectFiles), detected).has(current)) {
      reason = 'current is a fragment included by the detected root';
    }
    if (!reason) continue;

    changes.push({
      id: project.id,
      title: project.title,
      from: current ?? '(none)',
      to: detected,
      reason,
    });

    if (apply) {
      await prisma.projectSettings.upsert({
        where: { projectId: project.id },
        update: { mainPath: detected },
        create: { projectId: project.id, mainPath: detected },
      });
      updated += 1;
    }
  }

  console.log(
    `\n[backfill-main-paths] ${apply ? 'APPLY' : 'DRY-RUN'} — scanned ${scanned} project(s), ${changes.length} suspect.\n`,
  );
  for (const change of changes) {
    console.log(`  • ${change.title} (${change.id})`);
    console.log(`      ${change.from}  ->  ${change.to}    [${change.reason}]`);
  }
  if (changes.length === 0) {
    console.log('Nothing to change.');
  } else if (apply) {
    console.log(`\nUpdated ${updated} project(s).`);
  } else {
    console.log(`\nRe-run with --apply to write these ${changes.length} change(s).`);
  }
}

main()
  .catch((err) => {
    console.error('[backfill-main-paths] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
