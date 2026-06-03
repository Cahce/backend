/**
 * Unit Tests for FileKindPolicy
 * 
 * Tests all pure functions in FileKindPolicy module:
 * - detectKindFromPath (13 cases: one per extension + no extension)
 * - isBinaryKind (covering all 11 kinds)
 * - isCompilationInput (covering all 11 kinds)
 * - getMimeTypeForKind (covering all 11 kinds)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  detectKindFromPath,
  isBinaryKind,
  isCompilationInput,
  getMimeTypeForKind,
  getCompilationKinds,
  getExtension,
} from '../domain/FileKindPolicy.js';
import { FileKind } from '../domain/ProjectFile/Types.js';

describe('FileKindPolicy', () => {
  describe('detectKindFromPath', () => {
    it('should detect typst files', () => {
      assert.strictEqual(detectKindFromPath('main.typ'), FileKind.Typst);
      assert.strictEqual(detectKindFromPath('chapters/intro.typ'), FileKind.Typst);
      assert.strictEqual(detectKindFromPath('MAIN.TYP'), FileKind.Typst); // case insensitive
    });

    it('should detect bib files', () => {
      assert.strictEqual(detectKindFromPath('references.bib'), FileKind.Bib);
      assert.strictEqual(detectKindFromPath('bibliography/refs.bib'), FileKind.Bib);
    });

    it('should detect raster image files', () => {
      assert.strictEqual(detectKindFromPath('logo.png'), FileKind.Image);
      assert.strictEqual(detectKindFromPath('photo.jpg'), FileKind.Image);
      assert.strictEqual(detectKindFromPath('photo.jpeg'), FileKind.Image);
      assert.strictEqual(detectKindFromPath('animation.gif'), FileKind.Image);
      assert.strictEqual(detectKindFromPath('modern.webp'), FileKind.Image);
    });

    it('should detect vector files', () => {
      assert.strictEqual(detectKindFromPath('diagram.svg'), FileKind.Vector);
      assert.strictEqual(detectKindFromPath('assets/icon.svg'), FileKind.Vector);
    });

    it('should detect font files', () => {
      assert.strictEqual(detectKindFromPath('Lora-Regular.ttf'), FileKind.Font);
      assert.strictEqual(detectKindFromPath('Lora-Bold.otf'), FileKind.Font);
      assert.strictEqual(detectKindFromPath('Roboto.woff'), FileKind.Font);
      assert.strictEqual(detectKindFromPath('Roboto.woff2'), FileKind.Font);
    });

    it('should detect markdown files', () => {
      assert.strictEqual(detectKindFromPath('README.md'), FileKind.Markdown);
      assert.strictEqual(detectKindFromPath('docs/guide.md'), FileKind.Markdown);
    });

    it('should detect config files', () => {
      assert.strictEqual(detectKindFromPath('typst.toml'), FileKind.Config);
      assert.strictEqual(detectKindFromPath('config.yaml'), FileKind.Config);
      assert.strictEqual(detectKindFromPath('settings.yml'), FileKind.Config);
      assert.strictEqual(detectKindFromPath('package.json'), FileKind.Config);
    });

    it('should detect data files', () => {
      assert.strictEqual(detectKindFromPath('data.csv'), FileKind.Data);
      assert.strictEqual(detectKindFromPath('table.tsv'), FileKind.Data);
      assert.strictEqual(detectKindFromPath('structure.xml'), FileKind.Data);
    });

    it('should detect csl citation styles as data (compilation input, no migration)', () => {
      assert.strictEqual(detectKindFromPath('ieee.csl'), FileKind.Data);
      assert.strictEqual(detectKindFromPath('styles/tlu-thesis.csl'), FileKind.Data);
      assert.strictEqual(isCompilationInput(FileKind.Data), true);
      assert.strictEqual(isBinaryKind(FileKind.Data), false);
    });

    it('should detect text files', () => {
      assert.strictEqual(detectKindFromPath('notes.txt'), FileKind.Text);
      assert.strictEqual(detectKindFromPath('LICENSE.txt'), FileKind.Text);
    });

    it('should detect pdf files', () => {
      assert.strictEqual(detectKindFromPath('reference.pdf'), FileKind.Pdf);
      assert.strictEqual(detectKindFromPath('papers/article.pdf'), FileKind.Pdf);
    });

    it('should return "other" for unknown extensions', () => {
      assert.strictEqual(detectKindFromPath('file.xyz'), FileKind.Other);
      assert.strictEqual(detectKindFromPath('document.docx'), FileKind.Other);
      assert.strictEqual(detectKindFromPath('archive.zip'), FileKind.Other);
    });

    it('should return "other" for files without extension', () => {
      assert.strictEqual(detectKindFromPath('Makefile'), FileKind.Other);
      assert.strictEqual(detectKindFromPath('LICENSE'), FileKind.Other);
      assert.strictEqual(detectKindFromPath('README'), FileKind.Other);
    });

    it('should handle paths with multiple dots', () => {
      assert.strictEqual(detectKindFromPath('my.file.name.typ'), FileKind.Typst);
      assert.strictEqual(detectKindFromPath('archive.tar.gz'), FileKind.Other);
    });
  });

  describe('isBinaryKind', () => {
    it('should return true for binary kinds', () => {
      assert.strictEqual(isBinaryKind(FileKind.Image), true);
      assert.strictEqual(isBinaryKind(FileKind.Vector), true);
      assert.strictEqual(isBinaryKind(FileKind.Font), true);
      assert.strictEqual(isBinaryKind(FileKind.Pdf), true);
    });

    it('should return false for text kinds', () => {
      assert.strictEqual(isBinaryKind(FileKind.Typst), false);
      assert.strictEqual(isBinaryKind(FileKind.Bib), false);
      assert.strictEqual(isBinaryKind(FileKind.Markdown), false);
      assert.strictEqual(isBinaryKind(FileKind.Config), false);
      assert.strictEqual(isBinaryKind(FileKind.Data), false);
      assert.strictEqual(isBinaryKind(FileKind.Text), false);
      assert.strictEqual(isBinaryKind(FileKind.Other), false);
    });
  });

  describe('isCompilationInput', () => {
    it('should return true for compilation input kinds', () => {
      assert.strictEqual(isCompilationInput(FileKind.Typst), true);
      assert.strictEqual(isCompilationInput(FileKind.Bib), true);
      assert.strictEqual(isCompilationInput(FileKind.Image), true);
      assert.strictEqual(isCompilationInput(FileKind.Vector), true);
      assert.strictEqual(isCompilationInput(FileKind.Font), true);
      assert.strictEqual(isCompilationInput(FileKind.Data), true);
      assert.strictEqual(isCompilationInput(FileKind.Config), true);
    });

    it('should return false for non-compilation kinds', () => {
      assert.strictEqual(isCompilationInput(FileKind.Markdown), false);
      assert.strictEqual(isCompilationInput(FileKind.Text), false);
      assert.strictEqual(isCompilationInput(FileKind.Pdf), false);
      assert.strictEqual(isCompilationInput(FileKind.Other), false);
    });
  });

  describe('getCompilationKinds', () => {
    it('should return array of compilation kinds', () => {
      const kinds = getCompilationKinds();
      assert.ok(Array.isArray(kinds));
      assert.strictEqual(kinds.length, 7);
      assert.ok(kinds.includes(FileKind.Typst));
      assert.ok(kinds.includes(FileKind.Bib));
      assert.ok(kinds.includes(FileKind.Image));
      assert.ok(kinds.includes(FileKind.Vector));
      assert.ok(kinds.includes(FileKind.Font));
      assert.ok(kinds.includes(FileKind.Data));
      assert.ok(kinds.includes(FileKind.Config));
    });

    it('should not include non-compilation kinds', () => {
      const kinds = getCompilationKinds();
      assert.ok(!kinds.includes(FileKind.Markdown));
      assert.ok(!kinds.includes(FileKind.Text));
      assert.ok(!kinds.includes(FileKind.Pdf));
      assert.ok(!kinds.includes(FileKind.Other));
    });
  });

  describe('getMimeTypeForKind', () => {
    it('should return correct MIME type for image kinds', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Image, 'png'), 'image/png');
      assert.strictEqual(getMimeTypeForKind(FileKind.Image, 'gif'), 'image/gif');
      assert.strictEqual(getMimeTypeForKind(FileKind.Image, 'webp'), 'image/webp');
      assert.strictEqual(getMimeTypeForKind(FileKind.Image, 'jpg'), 'image/jpeg');
      assert.strictEqual(getMimeTypeForKind(FileKind.Image), 'image/jpeg'); // default
    });

    it('should return correct MIME type for vector kind', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Vector), 'image/svg+xml');
    });

    it('should return correct MIME type for font kinds', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Font, 'ttf'), 'font/ttf');
      assert.strictEqual(getMimeTypeForKind(FileKind.Font, 'otf'), 'font/otf');
      assert.strictEqual(getMimeTypeForKind(FileKind.Font, 'woff'), 'font/woff');
      assert.strictEqual(getMimeTypeForKind(FileKind.Font, 'woff2'), 'font/woff2');
      assert.strictEqual(getMimeTypeForKind(FileKind.Font), 'font/ttf'); // default
    });

    it('should return correct MIME type for pdf kind', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Pdf), 'application/pdf');
    });

    it('should return correct MIME type for markdown kind', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Markdown), 'text/markdown; charset=utf-8');
    });

    it('should return correct MIME type for config kinds', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Config, 'json'), 'application/json');
      assert.strictEqual(getMimeTypeForKind(FileKind.Config, 'toml'), 'application/toml');
      assert.strictEqual(getMimeTypeForKind(FileKind.Config, 'yaml'), 'application/yaml');
      assert.strictEqual(getMimeTypeForKind(FileKind.Config), 'application/yaml'); // default
    });

    it('should return correct MIME type for data kinds', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Data, 'csv'), 'text/csv');
      assert.strictEqual(getMimeTypeForKind(FileKind.Data, 'tsv'), 'text/tab-separated-values');
      assert.strictEqual(getMimeTypeForKind(FileKind.Data, 'xml'), 'application/xml');
      assert.strictEqual(
        getMimeTypeForKind(FileKind.Data, 'csl'),
        'application/vnd.citationstyles.style+xml',
      );
      assert.strictEqual(getMimeTypeForKind(FileKind.Data), 'application/xml'); // default
    });

    it('should return correct MIME type for typst kind', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Typst), 'text/x-typst; charset=utf-8');
    });

    it('should return correct MIME type for bib kind', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Bib), 'application/x-bibtex; charset=utf-8');
    });

    it('should return correct MIME type for text kind', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Text), 'text/plain; charset=utf-8');
    });

    it('should return octet-stream for other kind', () => {
      assert.strictEqual(getMimeTypeForKind(FileKind.Other), 'application/octet-stream');
    });
  });

  describe('getExtension', () => {
    it('should extract extension from path', () => {
      assert.strictEqual(getExtension('main.typ'), 'typ');
      assert.strictEqual(getExtension('logo.png'), 'png');
      assert.strictEqual(getExtension('path/to/file.svg'), 'svg');
    });

    it('should return lowercase extension', () => {
      assert.strictEqual(getExtension('FILE.TYP'), 'typ');
      assert.strictEqual(getExtension('IMAGE.PNG'), 'png');
    });

    it('should handle files with multiple dots', () => {
      assert.strictEqual(getExtension('my.file.name.typ'), 'typ');
      assert.strictEqual(getExtension('archive.tar.gz'), 'gz');
    });

    it('should return empty string for files without extension', () => {
      assert.strictEqual(getExtension('Makefile'), '');
      assert.strictEqual(getExtension('README'), '');
    });
  });
});
