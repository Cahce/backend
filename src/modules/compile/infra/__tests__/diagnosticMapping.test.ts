import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapSeverity, parseTypstDiagnostics } from '../diagnosticMapping.js';

// Use forward-slashed absolute paths matching the compiler's `path` shape.
const WORKDIR = 'C:/Users/x/proj';

describe('mapSeverity (numeric Severity enum from the napi binding)', () => {
  it('decodes numeric severities (1 = error, 2 = warning)', () => {
    assert.equal(mapSeverity(1), 'error');
    assert.equal(mapSeverity(2), 'warning');
  });

  it('never throws on a numeric severity (the original crash)', () => {
    // Pre-fix this path called (1).toLowerCase() → "severity?.toLowerCase is not a function".
    assert.doesNotThrow(() => mapSeverity(1));
    assert.doesNotThrow(() => mapSeverity(2));
  });

  it('still accepts case-insensitive string forms', () => {
    assert.equal(mapSeverity('Warning'), 'warning');
    assert.equal(mapSeverity('ERROR'), 'error');
    assert.equal(mapSeverity('hint'), 'hint');
    assert.equal(mapSeverity('info'), 'info');
  });

  it('defaults undefined / unexpected values to error without throwing', () => {
    assert.equal(mapSeverity(undefined), 'error');
    assert.equal(mapSeverity(null), 'error');
    assert.equal(mapSeverity({} as unknown), 'error');
    assert.equal(mapSeverity('weird'), 'error');
  });
});

describe('parseTypstDiagnostics', () => {
  it('maps a numeric-severity error with a 0-based range to 1-based', () => {
    const raw = [
      {
        message: 'cannot add integer and string',
        package: '',
        path: 'C:/Users/x/proj/main.typ',
        severity: 1,
        range: {
          start: { line: 0, character: 9 },
          end: { line: 0, character: 16 },
        },
      },
    ];
    const [d] = parseTypstDiagnostics(raw, WORKDIR);
    assert.equal(d.severity, 'error');
    assert.equal(d.message, 'cannot add integer and string');
    assert.equal(d.file, 'main.typ');
    assert.deepEqual(d.range?.start, { line: 1, column: 10 });
    assert.deepEqual(d.range?.end, { line: 1, column: 17 });
  });

  it('maps a warning (severity 2) and omits range when range is null', () => {
    const raw = [
      {
        message: 'unknown font family: zzz no such font',
        package: '',
        path: 'C:/Users/x/proj/main.typ',
        severity: 2,
        range: null,
      },
    ];
    const [d] = parseTypstDiagnostics(raw, WORKDIR);
    assert.equal(d.severity, 'warning');
    assert.equal(d.file, 'main.typ');
    assert.equal(d.range, undefined);
  });

  it('drops out-of-workspace paths (no leaked absolute path)', () => {
    const raw = [
      {
        message: 'boom',
        path: 'C:/Windows/Temp/other.typ',
        severity: 1,
        range: null,
      },
    ];
    const [d] = parseTypstDiagnostics(raw, WORKDIR);
    assert.equal(d.file, undefined);
  });

  it('falls back to "Unknown error" for a missing message and never throws', () => {
    const raw = [{ severity: 1 }, { severity: 2, path: 42 }];
    assert.doesNotThrow(() => parseTypstDiagnostics(raw, WORKDIR));
    const out = parseTypstDiagnostics(raw, WORKDIR);
    assert.equal(out[0].message, 'Unknown error');
    assert.equal(out[0].severity, 'error');
    assert.equal(out[1].severity, 'warning');
  });

  it('returns [] for a non-array input', () => {
    assert.deepEqual(parseTypstDiagnostics(undefined as unknown as unknown[], WORKDIR), []);
  });
});
