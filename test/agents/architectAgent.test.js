import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the providers module so no real LLM is needed
vi.mock('../../src/providers/index.js', () => ({
  getProvider: vi.fn(() => { throw new Error('No provider available'); }),
}));

const { default: ArchitectAgent } = await import('../../src/agents/architectAgent.js');

describe('ArchitectAgent', () => {
  let agent;
  const samplePatient = {
    resourceType: 'Patient',
    identifier: [{ system: 'urn:oid:1.2.3', value: '12345' }],
    name: [{ family: 'Smith', given: ['John'] }],
    gender: 'male',
    birthDate: '1990-01-01',
  };

  beforeEach(() => {
    agent = new ArchitectAgent();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('createProfileDesign()', () => {
    it('uses fallback when no LLM is available', async () => {
      const design = await agent.createProfileDesign(samplePatient);
      expect(design).toBeDefined();
      expect(design.resourceType).toBe('Patient');
    });

    it('returns correct shape: resourceType, profileName, fieldsFound, constraints', async () => {
      const design = await agent.createProfileDesign(samplePatient);

      expect(design).toHaveProperty('resourceType');
      expect(design).toHaveProperty('profileName');
      expect(design).toHaveProperty('fieldsFound');
      expect(design).toHaveProperty('constraints');
      expect(typeof design.resourceType).toBe('string');
      expect(typeof design.profileName).toBe('string');
      expect(Array.isArray(design.fieldsFound)).toBe(true);
      expect(Array.isArray(design.constraints)).toBe(true);
    });

    it('generates profileName as "Generated" + resourceType', async () => {
      const design = await agent.createProfileDesign(samplePatient);
      expect(design.profileName).toBe('GeneratedPatient');
    });

    it('constraints have path, min, and max', async () => {
      const design = await agent.createProfileDesign(samplePatient);

      for (const constraint of design.constraints) {
        expect(constraint).toHaveProperty('path');
        expect(constraint).toHaveProperty('min');
        expect(constraint).toHaveProperty('max');
        expect(typeof constraint.path).toBe('string');
        expect(typeof constraint.min).toBe('number');
        expect(typeof constraint.max).toBe('string');
      }
    });

    it('only constrains fields present in the source resource', async () => {
      const design = await agent.createProfileDesign(samplePatient);

      for (const field of design.fieldsFound) {
        expect(samplePatient).toHaveProperty(field);
      }

      for (const constraint of design.constraints) {
        const field = constraint.path.split('.')[1];
        expect(samplePatient).toHaveProperty(field);
      }
    });

    it('does not include fields absent from the source resource', async () => {
      const minimalPatient = {
        resourceType: 'Patient',
        name: [{ family: 'Doe' }],
      };

      const design = await agent.createProfileDesign(minimalPatient);

      expect(design.fieldsFound).toContain('name');
      expect(design.fieldsFound).not.toContain('identifier');
      expect(design.fieldsFound).not.toContain('gender');
      expect(design.fieldsFound).not.toContain('birthDate');
    });
  });
});
