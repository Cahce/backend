/**
 * Typst upgrade baseline / verification probe (spec: typst-version-upgrade, T0 + T6).
 * Records the installed typst.ts version, the bundled Typst LANGUAGE version
 * (#sys.version), and a real project's compile result (pages / timing /
 * diagnostics) so before↔after can be compared across the upgrade.
 *
 *   npx tsx scripts/typst-baseline.ts [projectId]
 */
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { createBlobStorage } from '../src/shared/storage/BlobStorageFactory.js';
import { getCompilationKinds } from '../src/modules/project-files/domain/FileKindPolicy.js';
import { config } from '../src/config/index.js';

dotenv.config();
const require = createRequire(import.meta.url);
const projectId = process.argv[2] ?? 'cmq3qeob7000xn0vmod2g0vra';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const storage = createBlobStorage(config.storage.driver, config.storage.dir);

async function streamToBuffer(key: string): Promise<Buffer> {
  const stream = await storage.get(key);
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

async function main(): Promise<void> {
  const fontDir = resolve(config.compile.fontDirs);
  const compiler = NodeCompiler.create({ fontArgs: [{ fontPaths: [fontDir] }] });

  // --- package + language versions ---
  const pkgNode = require('@myriaddreamin/typst-ts-node-compiler/package.json').version;
  const pkgTs = require('@myriaddreamin/typst.ts/package.json').version;
  let sysVersion: unknown = '(query failed)';
  try {
    sysVersion = compiler.query(
      { mainFileContent: '#metadata(str(sys.version)) <ver>\n' },
      { selector: '<ver>', field: 'value' },
    );
  } catch (e) {
    sysVersion = `(error: ${(e as Error).message})`;
  }

  console.log('=== Typst versions ===');
  console.log('@myriaddreamin/typst-ts-node-compiler =', pkgNode);
  console.log('@myriaddreamin/typst.ts               =', pkgTs);
  console.log('Typst language (#sys.version)         =', JSON.stringify(sysVersion));

  // --- real project compile ---
  const settings = await prisma.projectSettings.findUnique({ where: { projectId } });
  const files = await prisma.file.findMany({
    where: { projectId, kind: { in: getCompilationKinds() } },
    select: { path: true, textContent: true, storageKey: true },
  });
  if (files.length === 0) {
    console.log(`\n(no files for project ${projectId} — skipping compile probe)`);
    return;
  }

  const workDir = await mkdtemp(join(tmpdir(), 'typst-baseline-'));
  for (const f of files) {
    const dest = join(workDir, f.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, f.storageKey ? await streamToBuffer(f.storageKey) : (f.textContent ?? ''));
  }
  const entry = join(workDir, settings?.mainPath ?? 'main.typ');

  const projCompiler = NodeCompiler.create({
    workspace: workDir,
    fontArgs: [{ fontPaths: [fontDir] }],
  });
  const t0 = Date.now();
  const res = projCompiler.compile({ mainFilePath: entry });
  const hasError = res.hasError();
  const doc = res.result;
  const pages = doc ? doc.numOfPages : null;
  let pdfBytes: number | null = null;
  if (doc) pdfBytes = projCompiler.pdf(doc).length;
  const elapsedMs = Date.now() - t0;
  const warn = res.takeWarnings();
  const err = hasError ? res.takeError() : null;

  console.log(`\n=== Project compile probe (${projectId}) ===`);
  console.log('mainPath      =', settings?.mainPath);
  console.log('files (compile-kinds) =', files.length);
  console.log('hasError      =', hasError);
  console.log('pages         =', pages);
  console.log('pdf bytes     =', pdfBytes);
  console.log('compile ms    =', elapsedMs);
  console.log('warnings      =', warn?.shortDiagnostics?.length ?? 0);
  console.log('errors        =', err?.shortDiagnostics?.length ?? 0);
  for (const d of (err?.shortDiagnostics ?? warn?.shortDiagnostics ?? []).slice(0, 6)) {
    console.log('  -', JSON.stringify({ severity: d.severity, message: d.message }));
  }

  await rm(workDir, { recursive: true, force: true });
}

main()
  .catch((e) => {
    console.error('baseline failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
