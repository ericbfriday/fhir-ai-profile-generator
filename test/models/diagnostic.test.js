import { describe, it, expect } from 'vitest';
import { Diagnostic, parseDiagnostics } from '../../src/models/diagnostic.js';

describe('Diagnostic', () => {
  describe('constructor', () => {
    it('stores severity, file, line, and message', () => {
      const d = new Diagnostic('error', 'patient.fsh', 12, 'Unknown element');
      expect(d.severity).toBe('error');
      expect(d.file).toBe('patient.fsh');
      expect(d.line).toBe(12);
      expect(d.message).toBe('Unknown element');
    });

    it('accepts null file and line', () => {
      const d = new Diagnostic('info', null, null, 'General message');
      expect(d.file).toBeNull();
      expect(d.line).toBeNull();
    });
  });

  describe('toString()', () => {
    it('formats with file and line', () => {
      const d = new Diagnostic('error', 'input/fsh/patient.fsh', 5, 'Bad cardinality');
      expect(d.toString()).toBe('[error] input/fsh/patient.fsh:5 - Bad cardinality');
    });

    it('formats with file but no line', () => {
      const d = new Diagnostic('warn', 'patient.fsh', null, 'Unused import');
      expect(d.toString()).toBe('[warn] patient.fsh - Unused import');
    });

    it('formats with no file', () => {
      const d = new Diagnostic('info', null, null, 'Compilation complete');
      expect(d.toString()).toBe('[info] (no file) - Compilation complete');
    });
  });
});

describe('parseDiagnostics()', () => {
  it('parses error with file:line format', () => {
    const output = 'error  input/fsh/patient.fsh:12 - Unknown element "foo"';
    const results = parseDiagnostics(output);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
    expect(results[0].file).toBe('input/fsh/patient.fsh');
    expect(results[0].line).toBe(12);
    expect(results[0].message).toBe('Unknown element "foo"');
  });

  it('parses warn with file only (no line)', () => {
    const output = 'warn   input/fsh/patient.fsh - Unused profile element';
    const results = parseDiagnostics(output);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('warn');
    expect(results[0].file).toBe('input/fsh/patient.fsh');
    expect(results[0].line).toBeNull();
    expect(results[0].message).toBe('Unused profile element');
  });

  it('parses info with just a message (no file)', () => {
    const output = 'info   Compilation completed successfully';
    const results = parseDiagnostics(output);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('info');
    expect(results[0].file).toBeNull();
    expect(results[0].line).toBeNull();
    expect(results[0].message).toBe('Compilation completed successfully');
  });

  it('returns empty array for empty input', () => {
    expect(parseDiagnostics('')).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(parseDiagnostics(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(parseDiagnostics(undefined)).toEqual([]);
  });

  it('parses multi-line mixed output', () => {
    const output = [
      'info   Starting SUSHI compilation',
      'error  input/fsh/patient.fsh:3 - Unknown type "Foo"',
      'warn   input/fsh/patient.fsh - Profile has no constraints',
      'info   Compilation done with errors',
    ].join('\n');

    const results = parseDiagnostics(output);
    expect(results).toHaveLength(4);
    expect(results[0].severity).toBe('info');
    expect(results[1].severity).toBe('error');
    expect(results[1].line).toBe(3);
    expect(results[2].severity).toBe('warn');
    expect(results[2].file).toBe('input/fsh/patient.fsh');
    expect(results[3].severity).toBe('info');
  });

  it('skips lines that do not match diagnostic pattern', () => {
    const output = [
      'some random output',
      'error  input/fsh/test.fsh:1 - Real error',
      '  indented continuation',
      '',
    ].join('\n');

    const results = parseDiagnostics(output);
    expect(results).toHaveLength(1);
    expect(results[0].message).toBe('Real error');
  });
});
