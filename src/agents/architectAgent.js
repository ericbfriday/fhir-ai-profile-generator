const { getProvider } = require('../providers');

class ArchitectAgent {

    async createProfileDesign(sourceResource) {
        console.log('\n\n[1/5] Architect Agent');
        console.log('Received -', sourceResource.resourceType);

        let provider = null;
        try {
            provider = getProvider();
        } catch (err) {
            console.warn('[Architect Agent] LLM Provider unavailable — using fallback rule engine');
        }

        if (provider) {
            return await this._createDesignViaLlm(provider, sourceResource);
        }

        return this._createDesignViaFallback(sourceResource);
    }

    /**
     * Use the LLM Provider to analyze the Source Resource and produce
     * a Profile Design with Constraints.
     */
    async _createDesignViaLlm(provider, sourceResource) {
        const prompt = this._buildPrompt(sourceResource);

        const response = await provider.complete(prompt, {
            temperature: 0.2,
            systemPrompt:
                'You are a FHIR profiling expert. You analyze FHIR resource instances ' +
                'and determine what constraints a profile should express. ' +
                'Respond ONLY with valid JSON — no markdown fences, no explanation.',
        });

        const profileDesign = this._parseResponse(response.content, sourceResource);
        console.log('Found fields :', profileDesign.fieldsFound);
        return profileDesign;
    }

    /**
     * Construct the prompt that instructs the LLM to produce a Profile Design.
     */
    _buildPrompt(sourceResource) {
        return [
            'Analyze the following FHIR resource instance and produce a Profile Design.',
            '',
            'Source Resource JSON:',
            JSON.stringify(sourceResource, null, 2),
            '',
            'Instructions:',
            '1. Identify which fields present in this Source Resource should be constrained in a Profile.',
            '2. For each constrained field, determine the appropriate FHIR cardinality (min and max).',
            '   - Use integers for min (e.g. 0 or 1).',
            '   - Use integers or "*" for max (e.g. "1" or "*").',
            '3. Name the profile as "Generated" followed by the resourceType (e.g. "GeneratedPatient").',
            '',
            'Return your answer as a JSON object with this exact shape:',
            '{',
            '  "resourceType": "<base resource type>",',
            '  "profileName": "Generated<ResourceType>",',
            '  "fieldsFound": ["<field1>", "<field2>", ...],',
            '  "constraints": [',
            '    { "path": "<ResourceType>.<field>", "min": <number>, "max": "<string>" },',
            '    ...',
            '  ]',
            '}',
            '',
            'Respond with ONLY the JSON object. No markdown, no commentary.',
        ].join('\n');
    }

    /**
     * Parse the LLM response content into a Profile Design.
     * Falls back to the rule engine if parsing fails.
     */
    _parseResponse(content, sourceResource) {
        try {
            const parsed = JSON.parse(content.trim());

            // Validate the expected shape
            if (!parsed.resourceType || !parsed.profileName ||
                !Array.isArray(parsed.fieldsFound) || !Array.isArray(parsed.constraints)) {
                throw new Error('Response missing required Profile Design fields');
            }

            return {
                resourceType: parsed.resourceType,
                profileName: parsed.profileName,
                fieldsFound: parsed.fieldsFound,
                constraints: parsed.constraints.map(c => ({
                    path: c.path,
                    min: c.min,
                    max: String(c.max),
                })),
            };
        } catch (err) {
            console.warn('[Architect Agent] Failed to parse LLM response — falling back to rule engine:', err.message);
            return this._createDesignViaFallback(sourceResource);
        }
    }

    /**
     * Fallback: hardcoded rule engine for Profile Design generation.
     * Used when no LLM Provider is available or when LLM response parsing fails.
     */
    _createDesignViaFallback(sourceResource) {
        const cardinalityRules = {
            identifier: { min: 1, max: '*' },
            name:       { min: 1, max: '*' },
            gender:     { min: 0, max: '1' },
            birthDate:  { min: 0, max: '1' },
        };

        const fieldsFound = Object.keys(cardinalityRules)
            .filter(field => sourceResource[field]);

        console.log('Found fields :', fieldsFound);

        return {
            resourceType: sourceResource.resourceType,
            profileName: 'Generated' + sourceResource.resourceType,
            fieldsFound,
            constraints: fieldsFound.map(field => ({
                path: `${sourceResource.resourceType}.${field}`,
                min: cardinalityRules[field].min,
                max: cardinalityRules[field].max,
            })),
        };
    }
}

module.exports = ArchitectAgent;
