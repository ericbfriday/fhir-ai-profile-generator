import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the providers module so no real LLM is needed — forces fallback template
vi.mock('../../src/providers/index.js', () => ({
  getProvider: vi.fn(() => { throw new Error('No provider available'); }),
}));

const { default: FshAuthorAgent } = await import('../../src/agents/fshAuthorAgent.js');

describe('FshAuthorAgent', () => {
  let agent;
  const profileDesign = {
    resourceType: 'Patient',
    profileName: 'GeneratedPatient',
    fieldsFound: ['identifier', 'name', 'gender'],
    constraints: [
      { path: 'Patient.identifier', min: 1, max: '*' },
      { path: 'Patient.name', min: 1, max: '*' },
      { path: 'Patient.gender', min: 0, max: '1' },
    ],
  };

  beforeEach(() => {
    agent = new FshAuthorAgent();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('authorFsh()', () => {
    it('produces a string from a profile design', async () => {
      const fsh = await agent.authorFsh(profileDesign);
      expect(typeof fsh).toBe('string');
      expect(fsh.length).toBeGreaterThan(0);
    });

    it('contains Profile: line with the profile name', async () => {
      const fsh = await agent.authorFsh(profileDesign);
      expect(fsh).toContain('Profile: GeneratedPatient');
    });

    it('contains Parent: line with the resource type', async () => {
      const fsh = await agent.authorFsh(profileDesign);
      expect(fsh).toContain('Parent: Patient');
    });

    it('contains cardinality rules for each constraint', async () => {
      const fsh = await agent.authorFsh(profileDesign);

      expect(fsh).toContain('* identifier 1..*');
      expect(fsh).toContain('* name 1..*');
      expect(fsh).toContain('* gender 0..1');
    });

    it('handles a single constraint', async () => {
      const singleDesign = {
        resourceType: 'Observation',
        profileName: 'GeneratedObservation',
        fieldsFound: ['status'],
        constraints: [
          { path: 'Observation.status', min: 1, max: '1' },
        ],
      };

      const fsh = await agent.authorFsh(singleDesign);
      expect(fsh).toContain('Profile: GeneratedObservation');
      expect(fsh).toContain('Parent: Observation');
      expect(fsh).toContain('* status 1..1');
    });
  });
});
