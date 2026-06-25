/**
 * Unit tests for ImportToBibFile.
 *
 * Guards the N+1 fixes: dedupe is a single batched query, OpenAlex works are
 * fetched per NEW id only, and import-log rows are flushed once via createMany
 * (never per-row create).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImportToBibFile } from '../ImportToBibFile.js';
import type {
  OpenAlexApiPort,
  OpenAlexImportLogRepo,
  OpenAlexImportLogRecord,
  OpenAlexImportLogCreateInput,
} from '../../domain/Ports.js';
import type { OpenAlexWork } from '../../domain/Types.js';
import type { BibliographyService } from '../../../bibliography/application/BibliographyService.js';
import type { ProjectWriteAccessPolicy } from '../../../projects/domain/access/ProjectAccessPolicies.js';

function makeWork(id: string, title: string, authorName: string): OpenAlexWork {
  return {
    id,
    title,
    display_name: title,
    publication_year: 2024,
    type: 'article',
    authorships: [
      { author: { id: `A-${id}`, display_name: authorName }, author_position: 'first', institutions: [] },
    ],
  } as OpenAlexWork;
}

test('dedupes via one batched query, fetches only new ids, flushes logs via createMany', async () => {
  const getWorkByIdCalls: string[] = [];
  const apiClient: OpenAlexApiPort = {
    async getWorkById(id) {
      getWorkByIdCalls.push(id);
      // Distinct author + title per id so citation keys do not collide.
      const works: Record<string, { title: string; author: string }> = {
        W1: { title: 'Quantum entanglement in superconductors', author: 'Anderson Alice' },
        W2: { title: 'Galactic rotation curves revisited', author: 'Brown Bob' },
      };
      const w = works[id] ?? { title: `Title ${id}`, author: 'Doe Jane' };
      return makeWork(id, w.title, w.author);
    },
    async getWorkByDoi() {
      throw new Error('not used');
    },
    async searchWorks() {
      throw new Error('not used');
    },
  };

  let findImportedCalls = 0;
  let createCalls = 0;
  let createManyCalls = 0;
  let createManyRows: OpenAlexImportLogCreateInput[] = [];
  const importLogRepo: OpenAlexImportLogRepo = {
    async create() {
      createCalls++;
      return {} as OpenAlexImportLogRecord;
    },
    async createMany(rows) {
      createManyCalls++;
      createManyRows = rows;
    },
    async findByProjectAndOpenAlexId() {
      return null;
    },
    async findImportedByProjectAndOpenAlexIds() {
      findImportedCalls++;
      // 'W-existing' was imported in a previous run.
      return [
        {
          id: 'log1',
          userId: 'u1',
          projectId: 'p1',
          openAlexId: 'W-existing',
          citationKey: 'Existing2020',
          targetBibPath: 'refs.bib',
          doi: null,
          title: 'Old',
          year: 2020,
          status: 'imported',
          errorMessage: null,
          importedAt: new Date(0),
        },
      ];
    },
    async listByProject() {
      return [];
    },
  };

  const writeCalls: number[] = [];
  const bibliography = {
    async readBibFile() {
      return [];
    },
    mergeEntries(_existing: unknown, incoming: unknown[]) {
      return incoming;
    },
    async writeBibFile(_p: string, _path: string, merged: unknown[]) {
      writeCalls.push(merged.length);
    },
  } as unknown as BibliographyService;

  let writeAccessChecked = false;
  const projectAccess: ProjectWriteAccessPolicy = {
    async requireWriteAccess() {
      writeAccessChecked = true;
    },
  };

  const useCase = new ImportToBibFile(apiClient, bibliography, projectAccess, importLogRepo);

  const result = await useCase.execute({
    userId: 'u1',
    projectId: 'p1',
    openAlexIds: ['W-existing', 'W1', 'W2'],
    targetBibPath: 'refs.bib',
    conflictMode: 'skip',
  });

  assert.equal(writeAccessChecked, true);
  // Dedupe = exactly ONE batched lookup (no per-id findFirst N+1).
  assert.equal(findImportedCalls, 1);
  // HTTP fetch only for the two NEW ids.
  assert.deepEqual([...getWorkByIdCalls].sort(), ['W1', 'W2']);
  // Logs flushed once via createMany; per-row create never used.
  assert.equal(createCalls, 0);
  assert.equal(createManyCalls, 1);
  assert.equal(createManyRows.length, 3); // 1 skipped_duplicate + 2 imported
  // Bib written once with the two new entries.
  assert.deepEqual(writeCalls, [2]);
  // Result shape.
  assert.equal(result.imported.length, 2);
  assert.equal(result.skippedDuplicate.length, 1);
  assert.equal(result.skippedDuplicate[0]?.openAlexId, 'W-existing');
  assert.equal(result.failed.length, 0);
});

test('returns early (no fetch, no bib write) when every id is an existing duplicate', async () => {
  const apiClient: OpenAlexApiPort = {
    async getWorkById() {
      throw new Error('should not fetch when all ids are duplicates');
    },
    async getWorkByDoi() {
      throw new Error('not used');
    },
    async searchWorks() {
      throw new Error('not used');
    },
  };

  let createManyRows: OpenAlexImportLogCreateInput[] = [];
  let readBibCalls = 0;
  const importLogRepo: OpenAlexImportLogRepo = {
    async create() {
      return {} as OpenAlexImportLogRecord;
    },
    async createMany(rows) {
      createManyRows = rows;
    },
    async findByProjectAndOpenAlexId() {
      return null;
    },
    async findImportedByProjectAndOpenAlexIds() {
      return [
        {
          id: 'log1', userId: 'u1', projectId: 'p1', openAlexId: 'W-dup',
          citationKey: 'Dup2020', targetBibPath: 'refs.bib', doi: null, title: null,
          year: 2020, status: 'imported', errorMessage: null, importedAt: new Date(0),
        },
      ];
    },
    async listByProject() {
      return [];
    },
  };

  const bibliography = {
    async readBibFile() {
      readBibCalls++;
      return [];
    },
    mergeEntries(_e: unknown, incoming: unknown[]) {
      return incoming;
    },
    async writeBibFile() {
      throw new Error('should not write bib when nothing to import');
    },
  } as unknown as BibliographyService;

  const projectAccess: ProjectWriteAccessPolicy = {
    async requireWriteAccess() {},
  };

  const useCase = new ImportToBibFile(apiClient, bibliography, projectAccess, importLogRepo);

  const result = await useCase.execute({
    userId: 'u1',
    projectId: 'p1',
    openAlexIds: ['W-dup'],
    targetBibPath: 'refs.bib',
    conflictMode: 'skip',
  });

  assert.equal(readBibCalls, 0); // never read the bib (early return)
  assert.equal(createManyRows.length, 1); // the single skip log
  assert.equal(result.skippedDuplicate.length, 1);
  assert.equal(result.imported.length, 0);
});
