import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompilationResult from '../../src/models/compilationResult.js';
import { Diagnostic } from '../../src/models/diagnostic.js';
import Orchestrator from '../../src/orchestrator/orchestrator.js';

describe('Orchestrator', () => {
  let orchestrator;
  let mockCompile;
  let mockCreateProfileDesign;
  let mockAuthorFsh;
  let mockRepairFsh;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    orchestrator = new Orchestrator();

    // Replace agent/tool instances with mocks (instance-level injection)
    mockCreateProfileDesign = vi.fn().mockResolvedValue({
      resourceType: 'Patient',
      profileName: 'GeneratedPatient',
      fieldsFound: ['name'],
      constraints: [{ path: 'Patient.name', min: 1, max: '*' }],
    });
    mockAuthorFsh = vi.fn().mockResolvedValue('Profile: GeneratedPatient\nParent: Patient\n* name 1..*\n');
    mockRepairFsh = vi.fn().mockRejectedValue(new Error('Repair Agent requires LLM Provider'));
    mockCompile = vi.fn();

    orchestrator.architect = { createProfileDesign: mockCreateProfileDesign };
    orchestrator.fshAuthor = { authorFsh: mockAuthorFsh };
    orchestrator.repairAgent = { repairFsh: mockRepairFsh };
    orchestrator.sushiTool = { compile: mockCompile };
  });

  describe('constructor', () => {
    it('accepts options.maxRepairIterations', () => {
      const o = new Orchestrator({ maxRepairIterations: 5 });
      expect(o.maxRepairIterations).toBe(5);
    });

    it('defaults maxRepairIterations to 3', () => {
      const o = new Orchestrator();
      expect(o.maxRepairIterations).toBe(3);
    });

    it('creates agent and tool instances', () => {
      const o = new Orchestrator();
      expect(o.architect).toBeDefined();
      expect(o.fshAuthor).toBeDefined();
      expect(o.repairAgent).toBeDefined();
      expect(o.sushiTool).toBeDefined();
    });
  });

  describe('run()', () => {
    it('calls architect → fshAuthor → sushiTool in sequence', async () => {
      const successResult = new CompilationResult(true, 'ok', '', [], ['SD-GeneratedPatient.json']);
      mockCompile.mockResolvedValue(successResult);

      const patientJson = { resourceType: 'Patient', name: [{ family: 'Doe' }] };
      await orchestrator.run(patientJson);

      expect(mockCreateProfileDesign).toHaveBeenCalledWith(patientJson);
      expect(mockAuthorFsh).toHaveBeenCalled();
      expect(mockCompile).toHaveBeenCalled();
    });

    it('when compilation succeeds, no repair loop is entered', async () => {
      const successResult = new CompilationResult(true, 'ok', '', [], []);
      mockCompile.mockResolvedValue(successResult);

      const result = await orchestrator.run({ resourceType: 'Patient', name: [{ family: 'X' }] });

      expect(result.success).toBe(true);
      expect(mockRepairFsh).not.toHaveBeenCalled();
    });

    it('when compilation fails and repair agent throws, returns initial result', async () => {
      const failedDiagnostics = [new Diagnostic('error', 'test.fsh', 1, 'Bad syntax')];
      const failedResult = new CompilationResult(false, '', 'err', failedDiagnostics, []);
      mockCompile.mockResolvedValue(failedResult);

      const result = await orchestrator.run({ resourceType: 'Patient', name: [{ family: 'X' }] });

      expect(result.success).toBe(false);
      expect(result.diagnostics).toBe(failedDiagnostics);
    });

    it('passes fsh output from author to compiler', async () => {
      const successResult = new CompilationResult(true, '', '', [], []);
      mockCompile.mockResolvedValue(successResult);

      await orchestrator.run({ resourceType: 'Patient', name: [{ family: 'X' }] });

      expect(mockCompile).toHaveBeenCalledWith(
        'Profile: GeneratedPatient\nParent: Patient\n* name 1..*\n'
      );
    });
  });
});
