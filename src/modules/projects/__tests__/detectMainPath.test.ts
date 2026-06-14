import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  detectMainPath,
  parseManifestEntry,
  parseTypstDeps,
  pickGraphRoot,
  resolveDep,
  type DetectFile,
} from '../application/detectMainPath.js';

/** UniTyLab-shaped import: real entry is `90-Document/90-Document.typ`. */
function unityLabFixture(): DetectFile[] {
  return [
    { path: 'Template-Import.typ', content: '#let format-doc-general = none\n' },
    {
      path: '90-Document/90-Document.typ',
      content: [
        '#import "../Template-Import.typ": *',
        '#show: format-doc-general.with()',
        '#include "../00-Title/00-Title.typ"',
        '#include "../50-Bibliography/52-Glossary.typ"',
        '#include "../80-Structure/81-struct-pre.typ"',
        '#include "../80-Structure/82-struct-main.typ"',
        '#include "../80-Structure/83-struct-post.typ"',
        '#include "../70-Appendix/70-Appendix.typ"',
      ].join('\n'),
    },
    { path: '00-Title/00-Title.typ', content: '= Title\n' },
    { path: '50-Bibliography/52-Glossary.typ', content: '= Glossary\n' },
    { path: '80-Structure/81-struct-pre.typ', content: '= Pre\n' },
    {
      path: '80-Structure/82-struct-main.typ',
      content: '#include "../30-Chapters/Chapter1.typ"\n',
    },
    { path: '30-Chapters/Chapter1.typ', content: '= Chapter 1\n' },
    { path: '80-Structure/83-struct-post.typ', content: '= Post\n' },
    { path: '70-Appendix/70-Appendix.typ', content: '= Appendix\n' },
    { path: 'assets/logo.png', content: null },
  ];
}

describe('detectMainPath — include-graph root (AC-1.2 / AC-1.3)', () => {
  it('picks the document root, not the alphabetically-first file', () => {
    const files = unityLabFixture();
    // The legacy heuristic would have picked 00-Title/00-Title.typ.
    assert.strictEqual(detectMainPath(files, {}), '90-Document/90-Document.typ');
  });

  it('pickGraphRoot identifies the in-degree-0 max-reach .typ file', () => {
    assert.strictEqual(pickGraphRoot(unityLabFixture()), '90-Document/90-Document.typ');
  });

  it('returns the only .typ file for a single-file project', () => {
    assert.strictEqual(
      pickGraphRoot([{ path: 'paper.typ', content: '= Hi\n' }]),
      'paper.typ',
    );
  });

  it('returns null when files are mutually independent', () => {
    const files: DetectFile[] = [
      { path: 'a.typ', content: '= A\n' },
      { path: 'b.typ', content: '= B\n' },
    ];
    assert.strictEqual(pickGraphRoot(files), null);
  });

  it('returns null on an include cycle', () => {
    const files: DetectFile[] = [
      { path: 'a.typ', content: '#include "b.typ"\n' },
      { path: 'b.typ', content: '#include "a.typ"\n' },
    ];
    assert.strictEqual(pickGraphRoot(files), null);
  });
});

describe('detectMainPath — priority chain (AC-1.1 / AC-1.4 / AC-1.7)', () => {
  it('uses typst.toml [template] entrypoint resolved against [template] path', () => {
    const files: DetectFile[] = [
      { path: 'typst.toml', content: null },
      { path: 'lib.typ', content: '#let f = none\n' },
      { path: 'template/main.typ', content: '#include "chapter.typ"\n' },
      { path: 'template/chapter.typ', content: '= C\n' },
    ];
    const typstToml = [
      '[package]',
      'name = "demo"',
      'entrypoint = "lib.typ"',
      '[template]',
      'path = "template"',
      'entrypoint = "main.typ"',
    ].join('\n');
    assert.strictEqual(detectMainPath(files, { typstToml }), 'template/main.typ');
  });

  it('uses a legacy top-level project.toml entry', () => {
    const files: DetectFile[] = [
      { path: 'project.toml', content: null },
      { path: 'src/document.typ', content: '= Doc\n' },
      { path: 'lib/theme.typ', content: '#let theme = none\n' },
    ];
    const projectToml = 'name = "Custom"\nentry = "src/document.typ"\n';
    assert.strictEqual(detectMainPath(files, { projectToml }), 'src/document.typ');
  });

  it('does NOT pick [package] entrypoint (lib.typ) as the document main', () => {
    const files: DetectFile[] = [
      { path: 'typst.toml', content: null },
      { path: 'lib.typ', content: '#let f = none\n' },
      { path: 'doc.typ', content: '#include "part.typ"\n' },
      { path: 'part.typ', content: '= Part\n' },
    ];
    const typstToml = '[package]\nname = "x"\nentrypoint = "lib.typ"\n';
    // No [template] entry → falls to graph root, which is doc.typ (reaches part.typ).
    assert.strictEqual(detectMainPath(files, { typstToml }), 'doc.typ');
  });

  it('falls back to main.typ when no manifest entry and files are independent', () => {
    const files: DetectFile[] = [
      { path: 'main.typ', content: '= Main\n' },
      { path: 'notes.typ', content: '= Notes\n' },
    ];
    assert.strictEqual(detectMainPath(files, {}), 'main.typ');
  });

  it('falls back to the first .typ alphabetically as a last resort', () => {
    const files: DetectFile[] = [
      { path: 'zeta.typ', content: '= Z\n' },
      { path: 'alpha.typ', content: '= A\n' },
    ];
    assert.strictEqual(detectMainPath(files, {}), 'alpha.typ');
  });
});

describe('parseTypstDeps (AC-1.5)', () => {
  it('captures #include and #import string targets, excluding package specs', () => {
    const content = [
      '#include "chapters/intro.typ"',
      '#import "lib/theme.typ": *',
      '#import "@preview/cetz:0.2.0"',
      '#import "@local/foo:1.0.0": bar',
      '#import "/abs/util.typ" as util',
    ].join('\n');
    assert.deepStrictEqual(parseTypstDeps(content), [
      'chapters/intro.typ',
      'lib/theme.typ',
      '/abs/util.typ',
    ]);
  });
});

describe('resolveDep (AC-1.6)', () => {
  const set = new Set([
    '00-Title/00-Title.typ',
    'assets/x.typ',
    'a/c.typ',
  ]);

  it('resolves a relative ../ path against the importing file dir', () => {
    assert.strictEqual(
      resolveDep('90-Document/90-Document.typ', '../00-Title/00-Title.typ', set),
      '00-Title/00-Title.typ',
    );
  });

  it('resolves a leading-/ path against the project root', () => {
    assert.strictEqual(resolveDep('a/b.typ', '/assets/x.typ', set), 'assets/x.typ');
  });

  it('appends .typ when the bare target is missing', () => {
    assert.strictEqual(resolveDep('a/b.typ', 'c', set), 'a/c.typ');
  });

  it('rejects targets that escape the project root', () => {
    assert.strictEqual(resolveDep('a/b.typ', '../../x.typ', set), null);
  });

  it('rejects package specs', () => {
    assert.strictEqual(resolveDep('a/b.typ', '@preview/foo:1.0.0', set), null);
  });
});

describe('parseManifestEntry', () => {
  it('reads [template] path/entrypoint and a top-level entry', () => {
    const toml = [
      'name = "demo"',
      'entry = "root.typ"',
      '[template]',
      'path = "tpl"',
      'entrypoint = "main.typ"',
    ].join('\n');
    assert.deepStrictEqual(parseManifestEntry(toml), {
      templatePath: 'tpl',
      templateEntrypoint: 'main.typ',
      legacyEntry: 'root.typ',
    });
  });

  it('returns nulls for empty input', () => {
    assert.deepStrictEqual(parseManifestEntry(null), {
      templatePath: null,
      templateEntrypoint: null,
      legacyEntry: null,
    });
  });
});
