import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTypstStderr } from '../TypstStderrParser.js';

const WORKDIR = '/tmp/typst-work';

describe('parseTypstStderr', () => {
  it('returns empty array for empty stderr', () => {
    assert.deepEqual(parseTypstStderr('', WORKDIR), []);
  });

  it('parses a single error with location', () => {
    const stderr = `${WORKDIR}/main.typ:3:5: error: expected semicolon`;
    const result = parseTypstStderr(stderr, WORKDIR);
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'error');
    assert.equal(result[0].message, 'expected semicolon');
    assert.equal(result[0].file, 'main.typ');
    assert.deepEqual(result[0].range?.start, { line: 3, column: 5 });
    assert.deepEqual(result[0].range?.end, { line: 3, column: 5 });
  });

  it('parses a warning', () => {
    const stderr = `${WORKDIR}/main.typ:1:1: warning: unused variable`;
    const result = parseTypstStderr(stderr, WORKDIR);
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'warning');
  });

  it('parses a hint', () => {
    const stderr = `${WORKDIR}/main.typ:2:8: hint: consider using let binding`;
    const result = parseTypstStderr(stderr, WORKDIR);
    assert.equal(result.length, 1);
    assert.equal(result[0].severity, 'hint');
  });

  it('accumulates help hints on an error', () => {
    const stderr = [
      `${WORKDIR}/main.typ:5:1: error: type mismatch`,
      '= help: expected string',
      '= help: got integer',
    ].join('\n');
    const result = parseTypstStderr(stderr, WORKDIR);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].hints, ['expected string', 'got integer']);
  });

  it('parses two errors in different files', () => {
    const stderr = [
      `${WORKDIR}/main.typ:3:5: error: first error`,
      `${WORKDIR}/chapters/intro.typ:10:2: error: second error`,
    ].join('\n');
    const result = parseTypstStderr(stderr, WORKDIR);
    assert.equal(result.length, 2);
    assert.equal(result[0].file, 'main.typ');
    assert.equal(result[1].file, 'chapters/intro.typ');
  });

  it('strips ANSI color codes before parsing', () => {
    const stderr = `\x1b[31m${WORKDIR}/main.typ:1:1: error: colored error\x1b[0m`;
    const result = parseTypstStderr(stderr, WORKDIR);
    assert.equal(result.length, 1);
    assert.equal(result[0].message, 'colored error');
  });

  it('omits file for path outside workDir', () => {
    const stderr = `/other/path/file.typ:1:1: error: external error`;
    const result = parseTypstStderr(stderr, WORKDIR);
    assert.equal(result.length, 1);
    assert.equal(result[0].file, undefined);
  });

  it('hint lines not attached to a diagnostic are ignored', () => {
    const stderr = `= help: orphan hint`;
    const result = parseTypstStderr(stderr, WORKDIR);
    assert.equal(result.length, 0);
  });
});
