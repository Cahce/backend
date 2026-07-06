
import AdmZip from "adm-zip";
import { crc32 } from "node:zlib";

const BASE_URL = "http://localhost:3000";

function buildRawZip(filename: string, data: Buffer): Buffer {
  const nameBytes = Buffer.from(filename, "utf-8");
  const checksum = crc32(data);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0x21, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(data.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(nameBytes.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0x21, 14);
  centralHeader.writeUInt32LE(checksum, 16);
  centralHeader.writeUInt32LE(data.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(nameBytes.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const localPart = Buffer.concat([localHeader, nameBytes, data]);
  const centralPart = Buffer.concat([centralHeader, nameBytes]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localPart, centralPart, eocd]);
}
const TEST_EMAIL = "admin@tlu.edu.vn";
const TEST_PASSWORD = "123456";

let pass = 0;
let fail = 0;

function ok(label: string, detail = ""): void {
  pass++;
  console.log(`✓ ${label}${detail ? "  " + detail : ""}`);
}
function bad(label: string, detail: string): void {
  fail++;
  console.error(`✗ ${label}\n  ${detail}`);
}

async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await json<{ accessToken: string }>(res);
  return data.accessToken;
}

interface Project {
  id: string;
  title: string;
}

interface ProjectSettingsEnvelope {
  settings: {
    mainPath: string;
  };
}

async function createProject(token: string, title: string): Promise<Project> {
  const res = await fetch(`${BASE_URL}/api/v1/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title, category: "thesis" }),
  });
  if (!res.ok) throw new Error(`Create project failed: ${res.status}`);
  return json<Project>(res);
}

async function deleteProject(token: string, id: string): Promise<void> {
  await fetch(`${BASE_URL}/api/v1/projects/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function postZip(
  token: string,
  zipBytes: Buffer,
): Promise<Response> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(zipBytes)], { type: "application/zip" });
  form.append("file", blob, "import.zip");
  return fetch(`${BASE_URL}/api/v1/projects/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

async function run(): Promise<void> {
  console.log(`\nSmoke testing zip portability at ${BASE_URL}\n`);

  const token = await login();
  ok("Login");

  const project = await createProject(token, "Zip Export Smoke");
  try {
    {
      const res = await fetch(
        `${BASE_URL}/api/v1/projects/${project.id}/export`,
      );
      if (res.status === 401) ok("Export without auth → 401");
      else bad("Export without auth → expected 401", `got ${res.status}`);
    }

    {
      const res = await fetch(
        `${BASE_URL}/api/v1/projects/${project.id}/export`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        bad("Export happy path", `status=${res.status}`);
      } else {
        const ct = res.headers.get("content-type");
        const cd = res.headers.get("content-disposition");
        const buf = Buffer.from(await res.arrayBuffer());
        const isZipMagic =
          buf.length >= 4 &&
          buf[0] === 0x50 &&
          buf[1] === 0x4b &&
          (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07);
        if (ct !== "application/zip") {
          bad("Export Content-Type", `expected application/zip, got ${ct}`);
        } else if (!cd || !cd.includes("attachment")) {
          bad("Export Content-Disposition", `expected attachment, got ${cd}`);
        } else if (!isZipMagic) {
          bad("Export zip magic", `bytes: ${buf.slice(0, 4).toString("hex")}`);
        } else {
          ok("Export happy path", `${buf.length} bytes, ${cd}`);
        }
      }
    }
  } finally {
    await deleteProject(token, project.id);
  }

  const goodZip = new AdmZip();
  goodZip.addFile(
    "main.typ",
    Buffer.from("= Imported title\n\nSmoke test body.\n", "utf-8"),
  );
  goodZip.addFile(
    "project.toml",
    Buffer.from('name = "Smoke Import"\n', "utf-8"),
  );
  goodZip.addFile(
    "chapters/intro.typ",
    Buffer.from("== Intro\n\nNested folder.\n", "utf-8"),
  );

  let importedId: string | null = null;
  {
    const res = await postZip(token, goodZip.toBuffer());
    if (res.status !== 201) {
      const body = await res.text();
      bad("Import happy path", `status=${res.status} body=${body}`);
    } else {
      const created = await json<Project>(res);
      importedId = created.id;
      if (created.title === "Smoke Import") {
        ok("Import happy path → title from project.toml", `id=${created.id}`);
      } else {
        bad("Import title", `expected "Smoke Import", got "${created.title}"`);
      }

      const filesRes = await fetch(
        `${BASE_URL}/api/v1/projects/${created.id}/files`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const filesBody = await filesRes.json();
      const files = (filesBody.files ?? filesBody) as Array<{ path: string }>;
      const paths = files.map((f) => f.path).sort();
      const expected = ["chapters/intro.typ", "main.typ", "project.toml"];
      if (JSON.stringify(paths) === JSON.stringify(expected)) {
        ok("Import preserves file tree", paths.join(", "));
      } else {
        bad(
          "Import file tree",
          `expected ${JSON.stringify(expected)}, got ${JSON.stringify(paths)}`,
        );
      }
    }
  }
  if (importedId) await deleteProject(token, importedId);

  const wrappedZip = new AdmZip();
  wrappedZip.addFile(
    "templatemaudoantotnghiep/project.toml",
    Buffer.from('name = "Wrapped Import"\nentry = "main.typ"\n', "utf-8"),
  );
  wrappedZip.addFile(
    "templatemaudoantotnghiep/main.typ",
    Buffer.from('#include "chapters/Chuong3.typ"\n#bibliography("bibliography.bib")\n', "utf-8"),
  );
  wrappedZip.addFile(
    "templatemaudoantotnghiep/chapters/Chuong3.typ",
    Buffer.from("= Chuong 3\n\nNested chapter.\n", "utf-8"),
  );
  wrappedZip.addFile(
    "templatemaudoantotnghiep/bibliography.bib",
    Buffer.from("@article{sample2024,\n  title = {Sample},\n  year = {2024}\n}\n", "utf-8"),
  );

  let wrappedImportedId: string | null = null;
  {
    const res = await postZip(token, wrappedZip.toBuffer());
    if (res.status !== 201) {
      const body = await res.text();
      bad("Import wrapped project", `status=${res.status} body=${body}`);
    } else {
      const created = await json<Project>(res);
      wrappedImportedId = created.id;
      if (created.title === "Wrapped Import") {
        ok("Import wrapped project → title from stripped project.toml", `id=${created.id}`);
      } else {
        bad("Import wrapped title", `expected "Wrapped Import", got "${created.title}"`);
      }

      const filesRes = await fetch(
        `${BASE_URL}/api/v1/projects/${created.id}/files`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const filesBody = await filesRes.json();
      const files = (filesBody.files ?? filesBody) as Array<{ path: string }>;
      const paths = files.map((f) => f.path).sort();
      const expected = [
        "bibliography.bib",
        "chapters/Chuong3.typ",
        "main.typ",
        "project.toml",
      ];
      if (JSON.stringify(paths) === JSON.stringify(expected)) {
        ok("Import wrapped project strips archive root", paths.join(", "));
      } else {
        bad(
          "Import wrapped file tree",
          `expected ${JSON.stringify(expected)}, got ${JSON.stringify(paths)}`,
        );
      }

      const settingsRes = await fetch(
        `${BASE_URL}/api/v1/projects/${created.id}/settings`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const settingsBody = await json<ProjectSettingsEnvelope>(settingsRes);
      if (settingsBody.settings?.mainPath === "main.typ") {
        ok("Import wrapped project persists mainPath", settingsBody.settings.mainPath);
      } else {
        bad(
          "Import wrapped mainPath",
          `expected main.typ, got ${JSON.stringify(settingsBody)}`,
        );
      }
    }
  }
  if (wrappedImportedId) await deleteProject(token, wrappedImportedId);

  {
    const res = await fetch(`${BASE_URL}/api/v1/projects/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data; boundary=----test",
      },
      body: "------test--",
    });
    if (res.status === 400) {
      const body = await json<{ error?: { code?: string } }>(res);
      if (body.error?.code === "MISSING_FILE") {
        ok("Import without file → 400 MISSING_FILE");
      } else {
        bad("Import without file error code", `got ${JSON.stringify(body)}`);
      }
    } else {
      bad("Import without file → expected 400", `got ${res.status}`);
    }
  }

  {
    const res = await postZip(token, Buffer.from("not a zip", "utf-8"));
    if (res.status === 400) {
      const body = await json<{ error?: { code?: string } }>(res);
      if (body.error?.code === "ZIP_MALFORMED") {
        ok("Import malformed → 400 ZIP_MALFORMED");
      } else {
        bad("Import malformed error code", `got ${JSON.stringify(body)}`);
      }
    } else {
      bad("Import malformed → expected 400", `got ${res.status}`);
    }
  }

  {
    const evilZip = buildRawZip("../escape.typ", Buffer.from("= escape\n", "utf-8"));
    const res = await postZip(token, evilZip);
    if (res.status === 400) {
      const body = await json<{ error?: { code?: string } }>(res);
      if (body.error?.code === "ZIP_PATH_TRAVERSAL") {
        ok("Import path-traversal → 400 ZIP_PATH_TRAVERSAL");
      } else {
        bad("Import traversal error code", `got ${JSON.stringify(body)}`);
      }
    } else {
      bad("Import traversal → expected 400", `got ${res.status}`);
    }
  }

  console.log(`\nResults: ${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
