# Design — Bibliography Integration (Backend)

> **Database design** chi tiết tách ra file riêng: [`database-design.md`](./database-design.md). File này tập trung vào application layer (routes, DTO, use cases, container, mapping). Đọc cả hai trước khi implement.

## Tổng quan kiến trúc

3 module mới/mở rộng dưới `backend/src/modules/`, tuân thủ Clean Architecture (`delivery/http → application → domain ← infra`). Module `bibliography` là **shared domain utility** (không có HTTP layer), được inject vào `zotero` và `openalex` qua container.

```
zotero/  ─┐
          ├──► bibliography/ (BibEntry, Serializer, Parser, CitationKeyGen)
openalex/─┘                    │
                               ▼
                       project-files/FileRepoPrisma  (đọc/ghi file .bib)
```

## Cây thư mục cuối cùng

```txt
backend/src/
  shared/crypto/
    SecretCipher.ts                      # AES-256-GCM + HKDF từ JWT_SECRET (helper dùng chung)
  modules/
    bibliography/
      domain/
        BibEntry.ts                      # type BibEntryType, interface BibEntry
        BibSerializer.ts                 # entries[] → BibTeX string (escape {}, \)
        BibParser.ts                     # BibTeX string → entries[] (đọc lại file hiện có)
        CitationKeyGen.ts                # generate + dedupe (suffix a/b/c)
      application/
        BibliographyService.ts           # facade: readBibFile, writeBibFile, mergeEntries
    zotero/
      Container.ts
      domain/
        Types.ts                         # ZoteroItem (raw API shape), ZoteroCollection
        Ports.ts                         # ZoteroApiPort, ZoteroConnectionRepo, ZoteroSyncLogRepo
        Errors.ts                        # ZoteroNotConnectedError, ZoteroAuthError, ZoteroSyncError, ZoteroLibraryNotFoundError
        Mapping.ts                       # zoteroItem → BibEntry (loại + fields + creators)
      application/
        ConnectZotero.ts
        DisconnectZotero.ts
        GetMyConnection.ts
        ListCollections.ts
        ListItems.ts
        SyncToBibFile.ts                 # core use case: fetch items + map + write .bib + ghi log
        GetSyncLogs.ts
      infra/
        ZoteroApiClient.ts               # fetch wrapper, header Zotero-API-Key + Version
        ZoteroConnectionRepoPrisma.ts
        ZoteroSyncLogRepoPrisma.ts
      delivery/http/
        Routes.ts
        Dto.ts                           # Zod schema cho request/response
    openalex/
      Container.ts
      domain/
        Types.ts                         # OpenAlexWork (raw shape), OpenAlexAuthor
        Ports.ts                         # OpenAlexApiPort
        Errors.ts                        # OpenAlexNotFoundError, OpenAlexRateLimitError, OpenAlexUpstreamError
        Mapping.ts                       # openAlexWork → BibEntry + reconstruct abstract từ inverted_index
      application/
        SearchWorks.ts
        GetWorkById.ts
        ImportToBibFile.ts
      infra/
        OpenAlexApiClient.ts             # fetch wrapper, polite mode (mailto)
      delivery/http/
        Routes.ts
        Dto.ts
```

## Domain & Port

### `bibliography/domain/BibEntry.ts`

```ts
export type BibEntryType =
  | "article" | "book" | "incollection" | "inproceedings"
  | "phdthesis" | "mastersthesis" | "techreport" | "misc";

export interface BibEntryFields {
  title?: string;
  author?: string;          // "Last, First and Last, First"
  year?: string;
  journal?: string;
  booktitle?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  url?: string;
  publisher?: string;
  abstract?: string;
  note?: string;
}

export interface BibEntry {
  key: string;
  type: BibEntryType;
  fields: BibEntryFields;
}
```

### `bibliography/domain/CitationKeyGen.ts`

```ts
export function generateCitationKey(input: {
  authors: { lastName: string }[];
  year?: string;
  title?: string;
}): string;

export function dedupeKey(candidate: string, existingKeys: Set<string>): string;
// "Smith2024Mach" → "Smith2024Macha" nếu trùng → "Smith2024Machb" → ...
```

### `bibliography/domain/BibSerializer.ts` & `BibParser.ts`

- `serializeBib(entries: BibEntry[]): string` — thuần text, escape `{}`, `\`, không phụ thuộc thư viện ngoài.
- `parseBib(text: string): BibEntry[]` — tolerant parser: state machine cho `@type{key, field = {value}, ...}`, bỏ qua comment `%` ngoài entry.

### `zotero/domain/Ports.ts`

```ts
export interface ZoteroApiPort {
  listCollections(libraryType: 'user'|'group', libraryId: string, apiKey: string): Promise<ZoteroCollection[]>;
  listItems(args: { libraryType: 'user'|'group'; libraryId: string; apiKey: string; collectionKey?: string; start?: number; limit?: number }): Promise<{ items: ZoteroItem[]; total: number }>;
  verifyKey(libraryType: 'user'|'group', libraryId: string, apiKey: string): Promise<void>;  // 401 → ZoteroAuthError
}

export interface ZoteroConnectionRepo {
  getByUserId(userId: string): Promise<ZoteroConnectionRecord | null>;
  upsert(record: Omit<ZoteroConnectionRecord, 'id'|'connectedAt'|'updatedAt'>): Promise<ZoteroConnectionRecord>;
  deleteByUserId(userId: string): Promise<void>;
  touchLastSyncedAt(connectionId: string): Promise<void>;
}

export interface ZoteroSyncLogRepo {
  create(args: { connectionId: string; projectId?: string; syncType: 'full'|'incremental' }): Promise<{ id: string }>;
  markRunning(id: string): Promise<void>;
  markSuccess(id: string, itemsSynced: number): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
  listByProject(projectId: string, limit: number): Promise<SyncLogRecord[]>;
}
```

`ZoteroConnectionRecord.accessToken` luôn được **decrypt** ở repo trước khi trả lên application; application chuyển vào ApiPort khi gọi Zotero.

### `openalex/domain/Ports.ts`

```ts
export interface OpenAlexApiPort {
  searchWorks(q: SearchQuery): Promise<{ works: OpenAlexWork[]; meta: PageMeta }>;
  getWorkById(id: string): Promise<OpenAlexWork>;
}
```

## Mapping rules

### Zotero → BibEntry (`zotero/domain/Mapping.ts`)

| Zotero itemType | BibEntry.type | Fields ưu tiên |
|---|---|---|
| `journalArticle` | `article` | title, author, year, journal=`publicationTitle`, volume, issue→`number`, pages, doi, url, abstract→`abstractNote` |
| `book` | `book` | title, author, year, publisher, doi, url, isbn→`note` |
| `bookSection` | `incollection` | title, author, year, booktitle, publisher, pages |
| `conferencePaper` | `inproceedings` | title, author, year, booktitle=`proceedingsTitle`, pages, doi |
| `thesis` | `phdthesis` / `mastersthesis` | title, author, year, publisher=`university` |
| `report` | `techreport` | title, author, year, publisher=`institution`, number=`reportNumber` |
| _khác_ | `misc` | title, author, year, url |

Authors: từ `creators[]` lọc `creatorType in ['author','editor']` → `"lastName, firstName"`, nối bằng ` and `.

### OpenAlex → BibEntry (`openalex/domain/Mapping.ts`)

| OpenAlex.type | BibEntry.type | Fields |
|---|---|---|
| `journal-article` | `article` | title, author (từ authorships sort theo `author_position`), year=`publication_year`, journal=`primary_location.source.display_name`, volume=`biblio.volume`, number=`biblio.issue`, pages=`biblio.first_page-last_page`, doi (strip `https://doi.org/`), url=`open_access.oa_url \|\| primary_location.landing_page_url` |
| `book` | `book` | title, author, year, publisher=`primary_location.source.host_organization_name` |
| `book-chapter` | `incollection` | + booktitle |
| `proceedings-article` | `inproceedings` | + booktitle |
| `dissertation` | `phdthesis` | + publisher |
| _khác_ | `misc` | title, author, year, doi, url |

Abstract: reconstruct từ `abstract_inverted_index: Record<string, number[]>` → array có size = max(positions)+1, fill từng word vào positions, join `' '`. Bỏ qua nếu null.

## Routes & DTO

### `zotero/delivery/http/Routes.ts`

```ts
export async function zoteroRoutes(app: FastifyInstance, c: ZoteroContainer) {
  app.post("/zotero/connections", {
    preHandler: app.auth.verify,
    schema: { body: ConnectZoteroBody, response: { 201: ZoteroConnectionResponse } },
  }, async (req, reply) => {
    const conn = await c.connectZotero.execute({ userId: req.user.sub, ...req.body });
    return reply.code(201).send({ connection: conn });
  });

  app.get("/zotero/connections/me", { preHandler: app.auth.verify }, ...);
  app.delete("/zotero/connections/me", { preHandler: app.auth.verify }, ...);
  app.get("/zotero/collections", { preHandler: app.auth.verify }, ...);
  app.get("/zotero/items", { preHandler: app.auth.verify, schema: { querystring: ListItemsQuery } }, ...);
  app.post("/zotero/projects/:projectId/sync", { preHandler: app.auth.verify, schema: { params: ProjectIdParam, body: SyncBody } }, ...);
  app.get("/zotero/projects/:projectId/sync-logs", { preHandler: app.auth.verify }, ...);
}
```

### `zotero/delivery/http/Dto.ts` — schema chính

```ts
export const ConnectZoteroBody = z.object({
  apiKey: z.string().min(1).max(200),
  libraryId: z.string().min(1).max(50),
  libraryType: z.enum(["user", "group"]),
});

export const ZoteroConnectionDto = z.object({
  id: z.string(),
  libraryId: z.string(),
  libraryType: z.enum(["user", "group"]),
  connectedAt: z.string(),
  lastSyncedAt: z.string().nullable(),
  hasApiKey: z.literal(true),
});

export const ZoteroCollectionDto = z.object({
  key: z.string(),
  name: z.string(),
  parentKey: z.string().nullable(),
  numItems: z.number(),
});

export const ZoteroItemDto = z.object({
  key: z.string(),
  itemType: z.string(),
  title: z.string().nullable(),
  creators: z.array(z.object({
    creatorType: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    name: z.string().optional(),
  })),
  date: z.string().nullable(),
  publicationTitle: z.string().nullable(),
  doi: z.string().nullable(),
  url: z.string().nullable(),
  abstractNote: z.string().nullable(),
});

export const SyncBody = z.object({
  collectionKeys: z.array(z.string()).optional(),
  itemKeys: z.array(z.string()).optional(),
  targetBibPath: z.string().regex(/\.bib$/, "Must end with .bib"),
  syncType: z.enum(["full", "incremental"]),
});

export const ZoteroSyncLogDto = z.object({
  id: z.string(),
  syncType: z.enum(["full", "incremental"]),
  status: z.enum(["pending", "running", "success", "failed"]),
  targetBibPath: z.string().nullable(),     // MỚI (xem database-design.md §2.2)
  itemsSynced: z.number(),
  itemsAdded: z.number(),                    // MỚI
  itemsUpdated: z.number(),                  // MỚI
  itemsSkipped: z.number(),                  // MỚI
  errorCode: z.string().nullable(),          // MỚI
  errorMessage: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
});
```

### `openalex/delivery/http/Routes.ts`

```ts
app.get("/openalex/works", { preHandler: app.auth.verify, schema: { querystring: SearchWorksQuery } }, ...);
app.get("/openalex/works/:openAlexId", { preHandler: app.auth.verify }, ...);
app.post("/openalex/projects/:projectId/import", { preHandler: app.auth.verify, schema: { params: ProjectIdParam, body: ImportBody } }, ...);
```

```ts
export const SearchWorksQuery = z.object({
  search: z.string().min(1).max(200),
  yearFrom: z.coerce.number().int().min(1500).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1500).max(2100).optional(),
  isOA: z.coerce.boolean().optional(),
  type: z.string().optional(),
  perPage: z.coerce.number().int().min(1).max(50).default(25),
  page: z.coerce.number().int().min(1).default(1),
});

export const OpenAlexWorkDto = z.object({
  id: z.string(),                    // "W12345"
  doi: z.string().nullable(),
  title: z.string().nullable(),
  year: z.number().nullable(),
  type: z.string(),
  authors: z.array(z.object({ name: z.string(), position: z.string() })),
  journal: z.string().nullable(),
  volume: z.string().nullable(),
  issue: z.string().nullable(),
  pages: z.string().nullable(),
  isOA: z.boolean(),
  oaUrl: z.string().nullable(),
  landingUrl: z.string().nullable(),
  abstract: z.string().nullable(),
  citedByCount: z.number(),
});

export const ImportBody = z.object({
  openAlexIds: z.array(z.string()).min(1).max(50),
  targetBibPath: z.string().regex(/\.bib$/),
});

// Response chi tiết, dùng `OpenAlexImportLog` để phân loại (xem database-design.md §2.4)
export const ImportResponse = z.object({
  imported: z.array(z.object({ openAlexId: z.string(), citationKey: z.string() })),
  skippedDuplicate: z.array(z.object({ openAlexId: z.string(), existingKey: z.string() })),
  failed: z.array(z.object({ openAlexId: z.string(), errorMessage: z.string() })),
});
```

## Container wiring

### `zotero/Container.ts`

```ts
export class ZoteroContainer {
  readonly connectZotero: ConnectZotero;
  readonly disconnectZotero: DisconnectZotero;
  readonly getMyConnection: GetMyConnection;
  readonly listCollections: ListCollections;
  readonly listItems: ListItems;
  readonly syncToBibFile: SyncToBibFile;
  readonly getSyncLogs: GetSyncLogs;

  constructor(
    prisma: PrismaClient,
    bibliography: BibliographyService,
    apiClient: ZoteroApiPort,                  // default new ZoteroApiClient()
    cipher: SecretCipher,                       // shared/crypto
    projectAccess: ProjectAccessPolicy,         // từ projects module
  ) {
    const connRepo = new ZoteroConnectionRepoPrisma(prisma, cipher);
    const logRepo  = new ZoteroSyncLogRepoPrisma(prisma);

    this.connectZotero = new ConnectZotero(connRepo, apiClient);
    this.getMyConnection = new GetMyConnection(connRepo);
    this.disconnectZotero = new DisconnectZotero(connRepo);
    this.listCollections = new ListCollections(connRepo, apiClient);
    this.listItems = new ListItems(connRepo, apiClient);
    this.syncToBibFile = new SyncToBibFile(connRepo, apiClient, bibliography, logRepo, projectAccess);
    this.getSyncLogs = new GetSyncLogs(logRepo, projectAccess);
  }
}
```

### `openalex/Container.ts`

```ts
export class OpenAlexContainer {
  readonly searchWorks: SearchWorks;
  readonly getWorkById: GetWorkById;
  readonly importToBibFile: ImportToBibFile;

  constructor(
    bibliography: BibliographyService,
    apiClient: OpenAlexApiPort,                 // default new OpenAlexApiClient(config.openalexMailto)
    projectAccess: ProjectAccessPolicy,
  ) { ... }
}
```

## SyncToBibFile use case (core logic)

```ts
async execute({ userId, projectId, body }: Cmd): Promise<Result> {
  await this.projectAccess.requireAccess(projectId, userId);

  const conn = await this.connRepo.getByUserId(userId);
  if (!conn) throw new ZoteroNotConnectedError();

  const log = await this.logRepo.create({ connectionId: conn.id, projectId, syncType: body.syncType });
  await this.logRepo.markRunning(log.id);

  try {
    // 1. Fetch items: gộp tất cả collectionKeys + itemKeys lẻ, paginate đến hết
    const items = await this.fetchAllItems(conn, body);

    // 2. Read existing .bib (nếu có) để dedupe key
    const existing = await this.bibliography.readBibFile(projectId, body.targetBibPath);
    const existingKeys = new Set(existing.map(e => e.key));

    // 3. Map + dedupe
    const newEntries = items.map(item => {
      const entry = mapZoteroItemToBibEntry(item);
      entry.key = dedupeKey(entry.key, existingKeys);
      existingKeys.add(entry.key);
      return entry;
    });

    // 4. Merge: ghi đè entry trùng key, append entry mới
    const merged = mergeEntries(existing, newEntries);

    // 5. Write file qua project-files
    await this.bibliography.writeBibFile(projectId, body.targetBibPath, merged);

    // 6. Touch lastSyncedAt + log success
    await this.connRepo.touchLastSyncedAt(conn.id);
    await this.logRepo.markSuccess(log.id, newEntries.length);

    return { syncLog: { id: log.id, ...}, itemsSynced: newEntries.length };
  } catch (err) {
    await this.logRepo.markFailed(log.id, err.message);
    throw err;
  }
}
```

## Token encryption (`shared/crypto/SecretCipher.ts`)

```ts
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

export class SecretCipher {
  private key: Buffer;  // 32 bytes

  constructor(jwtSecret: string) {
    this.key = Buffer.from(hkdfSync("sha256", jwtSecret, Buffer.alloc(0), "zotero-token-v1", 32));
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
  }

  decrypt(blob: string): string {
    const [version, ivB64, tagB64, encB64] = blob.split(":");
    if (version !== "v1") throw new Error("Unsupported cipher version");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]).toString("utf8");
  }
}
```

Inject vào `ZoteroConnectionRepoPrisma`. `accessToken` field trong DB lưu chuỗi `v1:...`.

## Register vào `app.ts`

Thêm sau khối `projectFilesContainer` (~line 102):

```ts
import { ZoteroContainer } from "./modules/zotero/Container.js";
import { OpenAlexContainer } from "./modules/openalex/Container.js";
import { BibliographyService } from "./modules/bibliography/application/BibliographyService.js";
import { SecretCipher } from "./shared/crypto/SecretCipher.js";
import { ZoteroApiClient } from "./modules/zotero/infra/ZoteroApiClient.js";
import { OpenAlexApiClient } from "./modules/openalex/infra/OpenAlexApiClient.js";
import { zoteroRoutes } from "./modules/zotero/delivery/http/Routes.js";
import { openalexRoutes } from "./modules/openalex/delivery/http/Routes.js";

const cipher = new SecretCipher(app.config.auth.jwtSecret);
const bibliographyService = new BibliographyService(projectFilesContainer.getFileRepo());
const projectAccess = projectsContainer.getProjectAccessPolicy();  // nếu chưa expose → thêm getter
const zoteroContainer = new OpenAlexContainer(bibliographyService, new OpenAlexApiClient(app.config.openalexMailto), projectAccess);
const openalexContainer = new OpenAlexContainer(bibliographyService, new OpenAlexApiClient(app.config.openalexMailto), projectAccess);
const zoteroContainer2 = new ZoteroContainer(app.prisma, bibliographyService, new ZoteroApiClient(app.config.zoteroApiBase), cipher, projectAccess);

await app.register(async (i) => zoteroRoutes(i, zoteroContainer2), { prefix: "/api/v1" });
await app.register(async (i) => openalexRoutes(i, openalexContainer), { prefix: "/api/v1" });
```

(Naming cleanup khi implement — chỉ minh hoạ wiring.)

## Config (`backend/src/config/index.ts`)

Thêm field:

```ts
openalexMailto: process.env.OPENALEX_MAILTO ?? "",
zoteroApiBase: process.env.ZOTERO_API_BASE ?? "https://api.zotero.org",
```

Cập nhật `.env.example` cùng key. Không validate strict — `mailto` rỗng vẫn cho request OpenAlex hoạt động (chỉ mất polite-mode).

## Error mapping (delivery layer)

```ts
function toHttp(err: unknown): { code: number; body: ApiErrorBody } {
  if (err instanceof ZoteroNotConnectedError) return { code: 404, body: { error: { code: "ZOTERO_NOT_CONNECTED", message: "Chưa kết nối Zotero" } } };
  if (err instanceof ZoteroAuthError)         return { code: 401, body: { error: { code: "ZOTERO_AUTH_FAILED", message: "API key Zotero không hợp lệ" } } };
  if (err instanceof ZoteroSyncError)         return { code: 502, body: { error: { code: "ZOTERO_SYNC_FAILED", message: err.message } } };
  if (err instanceof OpenAlexNotFoundError)   return { code: 404, body: { error: { code: "OPENALEX_NOT_FOUND", message: "Không tìm thấy work" } } };
  if (err instanceof OpenAlexRateLimitError)  return { code: 429, body: { error: { code: "OPENALEX_RATE_LIMITED", message: "Quá nhiều yêu cầu" } } };
  // fallback
}
```

Sử dụng Fastify `setErrorHandler` riêng trong từng router, hoặc xử lý try/catch trong handler.

## Test plan

- Unit test: `bibliography/domain/{BibSerializer, BibParser, CitationKeyGen}` (round-trip, escape, dedupe).
- Unit test: `zotero/domain/Mapping` + `openalex/domain/Mapping` (fixtures JSON từ Zotero/OpenAlex docs).
- Unit test: `shared/crypto/SecretCipher` (encrypt → decrypt round-trip).
- API smoke (manual hoặc thêm `test:api:zotero`/`test:api:openalex` nếu test infra cho phép). Trong môi trường CI chưa có Zotero key thật → mock `ZoteroApiPort` qua container.

## Verification

```powershell
cd backend
npm run build
npm run test:unit               # nếu tests đã set up
# Manual:
# 1. Có sẵn user student + project trong DB seed
# 2. POST /api/v1/zotero/connections (Bearer token, body: { apiKey, libraryId, libraryType })
# 3. GET  /api/v1/zotero/collections  → list collection
# 4. POST /api/v1/zotero/projects/{id}/sync → file .bib xuất hiện trong project-files
# 5. GET  /api/v1/openalex/works?search=typst
# 6. POST /api/v1/openalex/projects/{id}/import (ids từ bước 5) → entry append vào .bib
```
