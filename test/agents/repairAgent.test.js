import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock providers to throw (no LLM available)
vi.mock('../../src/providers/index.js', () => ({
  getProvider: vi.fn(() => { throw new Error('No provider available'); }),
}));

const { default: RepairAgent } = await import('../../src/agents/repairAgent.js');
import { Diagnostic } from '../../src/models/diagnostic.js';

describe('RepairAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new RepairAgent();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('repairFsh()', () => {
    it('throws when no LLM Provider is available', async () => {
      const fsh = 'Profile: Broken\nParent: Patient\n';
      const diagnostics = [
        new Diagnostic('error', 'test.fsh', 1, 'Invalid syntax'),
      ];

      await expect(agent.repairFsh(fsh, diagnostics)).rejects.toThrow(
        'Repair Agent requires LLM Provider'
      );
    });
  });

  describe('_stripMarkdownFences()', () => {
    it('removes ```fsh opening fence and closing fence', () => {
      const input = '```fsh\nProfile: MyPatient\nParent: Patient\n```';
      const result = agent._stripMarkdownFences(input);
      expect(result).toBe('Profile: MyPatient\nParent: Patient');
    });

    it('removes ```FSH opening fence (case variant)', () => {
      const input = '```FSH\nProfile: MyPatient\nParent: Patient\n```';
      const result = agent._stripMarkdownFences(input);
      expect(result).toBe('Profile: MyPatient\nParent: Patient');
    });

    it('removes bare ``` fences without language tag', () => {
      const input = '```\nProfile: MyPatient\n```';
      const result = agent._stripMarkdownFences(input);
      expect(result).toBe('Profile: MyPatient');
    });

    it('returns content unchanged when no fences present', () => {
      const input = 'Profile: MyPatient\nParent: Patient';
      const result = agent._stripMarkdownFences(input);
      expect(result).toBe('Profile: MyPatient\nParent: Patient');
    });

    it('trims whitespace around content', () => {
      const input = '  \n```fsh\nProfile: X\n```\n  ';
      const result = agent._stripMarkdownFences(input);
      expect(result).toBe('Profile: X');
    });
  });

  describe('_buildPrompt()', () => {
    it('includes the failing FSH in the prompt', () => {
      const fsh = 'Profile: BadProfile\nParent: Patient\n* foo 1..1';
      const diagnostics = [
        new Diagnostic('error', 'test.fsh', 3, 'Unknown element "foo"'),
      ];

      const prompt = agent._buildPrompt(fsh, diagnostics);
      expect(prompt).toContain(fsh);
    });

    it('includes formatted diagnostics in the prompt', () => {
      const fsh = 'Profile: X\nParent: Patient';
      const diagnostics = [
        new Diagnostic('error', 'test.fsh', 1, 'Bad thing'),
        new Diagnostic('warn', 'test.fsh', null, 'Iffy thing'),
      ];

      const prompt = agent._buildPrompt(fsh, diagnostics);
      expect(prompt).toContain('[error] test.fsh:1 - Bad thing');
      expect(prompt).toContain('[warn] test.fsh - Iffy thing');
    });

    it('includes instruction text', () => {
      const prompt = agent._buildPrompt('Profile: X', []);
      expect(prompt).toContain('Fix ONLY the issues');
      expect(prompt).toContain('FHIR Shorthand');
    });
  });
});
