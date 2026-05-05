---
inclusion: manual
---

# Typst Editor Reference Implementations

This steering file provides guidance on using reference implementations in the `references/` directory when building the Typst editor for this project.

---

## Reference Repositories

### 1. TeXlyre (`references/texlyre/`)

**Description**: A local-first real-time LaTeX and Typst collaboration platform with offline editing capabilities.

**Key Technologies**:
- **Frontend**: React 19, TypeScript, Vite
- **Typst Compilation**: `@myriaddreamin/typst.ts` v0.7.0-rc2 (WASM-based, client-side)
- **Editor**: CodeMirror 6 with `codemirror-lang-typst`
- **Collaboration**: Yjs CRDTs + WebRTC for real-time sync
- **Storage**: IndexedDB (local-first)
- **PDF Rendering**: PDF.js

**Architecture Highlights**:
- **Local-first**: All data stored in IndexedDB, offline-capable
- **Plugin system**: Extensible viewers, renderers, backup providers
- **Hybrid compilation**: Client-side WASM compilation (no server needed)
- **Real-time collaboration**: Yjs + WebRTC for peer-to-peer sync

**Relevant Files to Study**:
```
references/texlyre/
├── src/
│   ├── components/
│   │   ├── Editor/           # CodeMirror editor integration
│   │   ├── PDFViewer/        # PDF.js viewer
│   │   └── FileExplorer/     # File management UI
│   ├── services/
│   │   ├── compiler/         # Typst compilation service
│   │   ├── collaboration/    # Yjs + WebRTC setup
│   │   └── storage/          # IndexedDB storage
│   └── extras/
│       ├── renderers/        # PDF/Canvas renderers
│       └── loggers/          # Typst log visualization
├── package.json              # Dependencies and versions
└── README.md                 # Architecture overview
```

**When to Reference**:
- ✅ Implementing client-side Typst compilation
- ✅ Building CodeMirror-based editor
- ✅ Adding real-time collaboration (Yjs)
- ✅ Implementing PDF preview
- ✅ Creating plugin architecture
- ✅ Handling Typst diagnostics/errors

---

### 2. Typst Online Editor (`references/typst-online-editor/`)

**Description**: A lightweight web-based Typst editor with client-side compilation using Next.js.

**Key Technologies**:
- **Frontend**: Next.js 16, React 19, TypeScript
- **Typst Compilation**: `@myriaddreamin/typst.ts` v0.7.0-rc2 (WASM-based)
- **PDF Rendering**: PDF.js (pdfjs-dist v5.4.530)
- **Syntax Highlighting**: Shiki

**Architecture Highlights**:
- **Fully client-side**: No backend, everything in browser
- **Minimal**: Focused demo with file explorer and PDF preview
- **Portable**: Compiler logic is framework-agnostic
- **Debounced compilation**: Compiles as you type

**Relevant Files to Study**:
```
references/typst-online-editor/
├── src/
│   ├── app/                  # Next.js app structure
│   ├── components/           # React components
│   └── lib/                  # Compiler logic (portable)
├── package.json              # Dependencies
└── README.md                 # Deployment guide
```

**When to Reference**:
- ✅ Quick prototyping of Typst editor
- ✅ Understanding minimal Typst.ts integration
- ✅ Implementing debounced compilation
- ✅ Simple file explorer UI
- ✅ Next.js deployment patterns

---

## Our Project Architecture (Backend-Authoritative Hybrid)

**IMPORTANT**: Our project uses a **backend-authoritative hybrid editor** model, which differs from the reference implementations:

### Reference Implementations (Client-Side Only)
- ✅ Compilation happens in browser (WASM)
- ✅ No backend required
- ✅ Local-first storage (IndexedDB)
- ❌ No server-side compilation
- ❌ No authoritative backend

### Our Project (Backend-Authoritative Hybrid)
- ✅ **Client-side**: Fast preview, low-latency editing (optional)
- ✅ **Backend**: Authoritative compilation, persistence, collaboration
- ✅ **Hybrid**: Best of both worlds
- ✅ **Backend uses**: `@myriaddreamin/typst-ts-node-compiler` (Node.js)
- ✅ **Frontend may use**: `@myriaddreamin/typst.ts` (WASM, optional)

**Key Differences**:
1. **Compilation Authority**: Backend is source of truth for official compile/export
2. **Storage**: Backend database (PostgreSQL) + optional client cache
3. **Collaboration**: Backend-coordinated (not pure P2P)
4. **Artifacts**: Backend stores official PDFs in blob storage

---

## Integration Patterns

### Pattern 1: Client-Side Preview (Optional Fast Feedback)

**Reference**: TeXlyre's client-side compilation

**Use Case**: Instant preview while typing (no network latency)

**Implementation**:
```typescript
// Frontend (optional)
import { $typst } from '@myriaddreamin/typst.ts';

async function compilePreview(content: string) {
  const result = await $typst.compile({
    mainFileContent: content,
    mainFilePath: 'main.typ',
  });
  
  if (result.result === 'ok') {
    // Show preview PDF
    displayPDF(result.pdf);
  } else {
    // Show diagnostics
    showDiagnostics(result.diagnostics);
  }
}
```

**When to Use**:
- ✅ Fast preview for simple documents
- ✅ Offline editing capability
- ✅ Reduce server load for drafts

**When NOT to Use**:
- ❌ Official export (always use backend)
- ❌ Large documents with many files
- ❌ Documents requiring server-side resources

---

### Pattern 2: Backend Compilation (Authoritative)

**Reference**: Our `NodeTypstCompileService`

**Use Case**: Official compilation for export, sharing, archiving

**Implementation**:
```typescript
// Backend (authoritative)
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';

async function compileOfficial(input: TypstCompileInput) {
  const compiler = NodeCompiler.create({
    workspace: input.workDir,
  });
  
  const result = compiler.compile({
    mainFileContent: content,
    mainFilePath: input.entryPath,
  });
  
  if (result.hasError()) {
    return { ok: false, diagnostics: parseDiagnostics(result) };
  }
  
  const pdfBuffer = compiler.pdf(result.result);
  await writeFile(input.outputPath, pdfBuffer);
  
  return { ok: true, diagnostics: [] };
}
```

**When to Use**:
- ✅ **ALWAYS** for official export
- ✅ Final PDF generation
- ✅ Shared/published documents
- ✅ Archived versions

---

### Pattern 3: Hybrid Approach (Recommended)

**Workflow**:
1. **Draft Phase**: Client-side preview (fast feedback)
2. **Save Phase**: Backend stores source + metadata
3. **Export Phase**: Backend compiles officially
4. **Share Phase**: Backend serves official PDF

**Benefits**:
- ⚡ Fast: Client preview for instant feedback
- 🔒 Reliable: Backend ensures correctness
- 📦 Scalable: Offload heavy compilation to server
- 🌐 Collaborative: Backend coordinates state

---

## CodeMirror Integration

**Reference**: TeXlyre's CodeMirror setup

**Key Packages**:
```json
{
  "codemirror": "^6.0.2",
  "codemirror-lang-typst": "^0.4.0",
  "@codemirror/lint": "^6.9.5",
  "@codemirror/autocomplete": "^6.20.1",
  "@codemirror/language": "^6.12.3"
}
```

**Basic Setup**:
```typescript
import { EditorView, basicSetup } from 'codemirror';
import { typst } from 'codemirror-lang-typst';
import { linter } from '@codemirror/lint';

const editor = new EditorView({
  doc: initialContent,
  extensions: [
    basicSetup,
    typst(),
    linter(typstLinter), // Custom linter for backend diagnostics
  ],
  parent: document.getElementById('editor'),
});
```

**Diagnostic Integration**:
```typescript
// Convert backend diagnostics to CodeMirror format
function typstLinter(view: EditorView) {
  const diagnostics = await fetchBackendDiagnostics();
  
  return diagnostics.map(diag => ({
    from: posToOffset(view.state.doc, diag.range.start),
    to: posToOffset(view.state.doc, diag.range.end),
    severity: diag.severity,
    message: diag.message,
    source: 'server', // Mark as server-side diagnostic
  }));
}
```

---

## PDF Rendering

**Reference**: Both repos use PDF.js

**Key Package**:
```json
{
  "pdfjs-dist": "^5.4.296"
}
```

**Basic Setup**:
```typescript
import * as pdfjsLib from 'pdfjs-dist';

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

async function renderPDF(pdfData: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const page = await pdf.getPage(1);
  
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.getElementById('pdf-canvas');
  const context = canvas.getContext('2d');
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({ canvasContext: context, viewport }).promise;
}
```

**Our Backend Integration**:
```typescript
// Frontend fetches PDF from backend
async function loadPDF(projectId: string, jobId: string) {
  const response = await fetch(
    `/api/v1/projects/${projectId}/compile/${jobId}/artifact`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  const pdfData = await response.arrayBuffer();
  await renderPDF(pdfData);
}
```

---

## File Management

**Reference**: TeXlyre's file explorer

**Key Features**:
- Drag-and-drop file upload
- File tree navigation
- File type icons
- Context menu actions

**Our Backend Integration**:
```typescript
// Create file via backend API
async function createFile(projectId: string, path: string, content: string) {
  await fetch(`/api/v1/projects/${projectId}/files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      kind: 'typst',
      content,
    }),
  });
}

// Get file via backend API
async function getFile(projectId: string, path: string) {
  const response = await fetch(
    `/api/v1/projects/${projectId}/files/${path}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  return await response.json();
}
```

---

## Collaboration (Future)

**Reference**: TeXlyre's Yjs + WebRTC

**Note**: Our project will use **backend-coordinated collaboration**, not pure P2P.

**Key Differences**:
- **TeXlyre**: Yjs + WebRTC (P2P, no server)
- **Our Project**: Yjs + WebSocket (backend-coordinated)

**Future Implementation**:
```typescript
// Backend WebSocket server
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';

const wss = new WebSocketServer({ port: 3001 });

wss.on('connection', (ws) => {
  const doc = new Y.Doc();
  
  ws.on('message', (data) => {
    // Sync Yjs updates through backend
    Y.applyUpdate(doc, data);
    
    // Broadcast to other clients
    wss.clients.forEach(client => {
      if (client !== ws) {
        client.send(Y.encodeStateAsUpdate(doc));
      }
    });
  });
});
```

---

## Diagnostic Parsing

**Reference**: TeXlyre's Typst log parser

**Our Implementation**: Already done in `NodeTypstCompileService`

**Key Points**:
- Parse `NodeError.shortDiagnostics` from compiler
- Map to our `CompileDiagnostic` format
- Include file, range, severity, message, hints
- Frontend renders diagnostics in CodeMirror

**Example**:
```typescript
// Backend parses diagnostics
function parseDiagnostics(typstDiagnostics: any[]): CompileDiagnostic[] {
  return typstDiagnostics.map(diag => ({
    severity: mapSeverity(diag.severity),
    message: diag.message || 'Unknown error',
    file: diag.span?.path,
    range: diag.span ? {
      start: {
        line: diag.span.start.line || 1,
        column: diag.span.start.column || 1,
      },
      end: {
        line: diag.span.end.line || 1,
        column: diag.span.end.column || 1,
      },
    } : undefined,
    hints: diag.hints || [],
  }));
}
```

---

## Deployment Patterns

### TeXlyre Deployment
- **Static site**: Vite build → GitHub Pages
- **PWA**: Service worker for offline
- **No backend**: Fully client-side

### Typst Online Editor Deployment
- **Vercel**: Next.js SSR/SSG
- **Static export**: Can be deployed to GitHub Pages
- **No backend**: Fully client-side

### Our Project Deployment
- **Backend**: Node.js server (Fastify)
- **Frontend**: Separate SPA or SSR (TBD)
- **Database**: PostgreSQL
- **Storage**: Local filesystem or S3
- **Compile**: Backend Node.js process

---

## Key Takeaways

### ✅ What to Adopt from References

1. **CodeMirror Setup**: Use TeXlyre's CodeMirror configuration
2. **PDF.js Integration**: Use their PDF rendering approach
3. **File Explorer UI**: Adapt TeXlyre's file tree component
4. **Diagnostic Display**: Use CodeMirror linter for diagnostics
5. **Typst.ts API**: Learn from their compiler integration

### ⚠️ What to Adapt (Not Copy Directly)

1. **Storage**: References use IndexedDB, we use PostgreSQL
2. **Compilation**: References are client-only, we're hybrid
3. **Collaboration**: References use P2P, we use backend-coordinated
4. **Authentication**: References have none, we have JWT auth
5. **File Management**: References are local, we have backend API

### ❌ What NOT to Use

1. **Local-first architecture**: We're backend-authoritative
2. **WebRTC P2P**: We use backend WebSocket
3. **IndexedDB as primary storage**: We use PostgreSQL
4. **Client-side only compilation**: We have backend compilation
5. **No authentication**: We have role-based access control

---

## Reference File Locations

### TeXlyre Key Files

**Compiler Integration**:
- `references/texlyre/src/services/compiler/` - Typst.ts integration
- `references/texlyre/extras/loggers/typst_visualizer/` - Diagnostic parsing

**Editor**:
- `references/texlyre/src/components/Editor/` - CodeMirror setup
- `references/texlyre/src/components/Editor/extensions/` - Custom extensions

**PDF Viewer**:
- `references/texlyre/src/components/PDFViewer/` - PDF.js integration

**File Management**:
- `references/texlyre/src/components/FileExplorer/` - File tree UI
- `references/texlyre/src/services/storage/` - IndexedDB storage

**Collaboration**:
- `references/texlyre/src/services/collaboration/` - Yjs + WebRTC

### Typst Online Editor Key Files

**Compiler**:
- `references/typst-online-editor/src/lib/` - Portable compiler logic

**Components**:
- `references/typst-online-editor/src/components/` - React components

**App Structure**:
- `references/typst-online-editor/src/app/` - Next.js pages

---

## Usage Guidelines

### When Building Frontend

1. **Study TeXlyre's CodeMirror setup** for editor integration
2. **Reference PDF.js usage** for PDF preview
3. **Adapt file explorer UI** for our backend API
4. **Learn diagnostic rendering** for error display

### When Building Backend

1. **Our implementation is already correct** (`NodeTypstCompileService`)
2. **Reference diagnostics format** to ensure frontend compatibility
3. **Study error handling patterns** for robustness

### When Integrating

1. **Frontend calls backend API** for official compilation
2. **Optional client-side preview** for fast feedback
3. **Backend stores artifacts** in blob storage
4. **Frontend fetches PDFs** from backend

---

## Quick Reference Commands

### Explore TeXlyre
```bash
cd references/texlyre
npm install
npm run dev
# Open http://localhost:4173
```

### Explore Typst Online Editor
```bash
cd references/typst-online-editor
npm install
npm run dev
# Open http://localhost:3000
```

### Study Specific Features
```bash
# Find compiler integration
grep -r "typst.ts" references/texlyre/src/

# Find PDF rendering
grep -r "pdfjs" references/texlyre/src/

# Find CodeMirror setup
grep -r "EditorView" references/texlyre/src/
```

---

## Conclusion

The reference implementations provide **excellent examples** of client-side Typst editors, but remember:

- **Our architecture is hybrid**: Client for preview, backend for authority
- **Adapt, don't copy**: Take UI/UX patterns, not architecture
- **Backend is source of truth**: Always defer to backend for official results
- **References are learning tools**: Study their approach, implement our way

**When in doubt**: Prioritize backend-authoritative behavior over client-side convenience.
