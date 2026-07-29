import { describe, it, expect } from 'vitest';
import CompilationResult from '../../src/models/compilationResult.js';
import { Diagnostic } from '../../src/models/diagnostic.js';

describe('CompilationResult', () => {
  describe('constructor', () => {
    it('sets all fields correctly', () => {
      const diagnostics = [
        new Diagnostic('error', 'a.fsh', 1, 'bad'),
        new Diagnostic('warn', 'b.fsh', null, 'meh'),
      ];
      const artifacts = ['StructureDefinition-Foo.json'];

      const result = new CompilationResult(true, 'stdout text', 'stderr text', diagnostics, artifacts);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('stdout text');
      expect(result.stderr).toBe('stderr text');
      expect(result.diagnostics).toBe(diagnostics);
      expect(result.artifacts).toEqual(['StructureDefinition-Foo.json']);
    });

    it('defaults diagnostics and artifacts to empty arrays', () => {
      const result = new CompilationResult(false, '', '');
      expect(result.diagnostics).toEqual([]);
      expect(result.artifacts).toEqual([]);
    });
  });

  describe('.errors getter', () => {
    it('filters diagnostics with severity error', () => {
      const diagnostics = [
        new Diagnostic('error', 'a.fsh', 1, 'first error'),
        new Diagnostic('warn', 'a.fsh', 2, 'a warning'),
        new Diagnostic('error', 'a.fsh', 3, 'second error'),
        new Diagnostic('info', null, null, 'info message'),
      ];

      const result = new CompilationResult(false, '', '', diagnostics);
      const errors = result.errors;

      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('first error');
      expect(errors[1].message).toBe('second error');
    });

    it('returns empty array when no errors exist', () => {
      const diagnostics = [
        new Diagnostic('warn', 'a.fsh', 1, 'warning'),
        new Diagnostic('info', null, null, 'info'),
      ];
      const result = new CompilationResult(true, '', '', diagnostics);
      expect(result.errors).toEqual([]);
    });
  });

  describe('.warnings getter', () => {
    it('filters diagnostics with severity warn', () => {
      const diagnostics = [
        new Diagnostic('error', 'a.fsh', 1, 'an error'),
        new Diagnostic('warn', 'a.fsh', 2, 'first warning'),
        new Diagnostic('warn', 'b.fsh', 5, 'second warning'),
      ];

      const result = new CompilationResult(false, '', '', diagnostics);
      const warnings = result.warnings;

      expect(warnings).toHaveLength(2);
      expect(warnings[0].message).toBe('first warning');
      expect(warnings[1].message).toBe('second warning');
    });

    it('returns empty array when no warnings exist', () => {
      const result = new CompilationResult(true, '', '', []);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('empty diagnostics', () => {
    it('errors and warnings both return empty arrays', () => {
      const result = new CompilationResult(true, '', '', []);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });
});
