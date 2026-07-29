const { getProvider } = require('../providers');

/**
 * Repair Agent — receives structured Diagnostics and failing FSH,
 * uses the LLM Provider to reason about what's wrong, and produces
 * corrected FSH.
 *
 * Unlike the Architect Agent and FSH Author Agent, the Repair Agent has
 * NO fallback — repair inherently requires reasoning about what's wrong.
 */
class RepairAgent {

    /**
     * Repair failing FSH using structured Diagnostics from SUSHI.
     *
     * @param {string} fsh - The failing FSH string
     * @param {import('../models/diagnostic').Diagnostic[]} diagnostics - Array of Diagnostic objects from SUSHI
     * @returns {Promise<string>} Corrected FSH string
     * @throws {Error} If no LLM Provider is available
     */
    async repairFsh(fsh, diagnostics) {
        const errors = diagnostics.filter(d => d.severity === 'error');
        const warnings = diagnostics.filter(d => d.severity === 'warn');

        console.log(`[Repair Agent] Attempting to repair FSH (${errors.length} errors, ${warnings.length} warnings)`);

        let provider;
        try {
            provider = getProvider();
        } catch (err) {
            throw new Error('Repair Agent requires LLM Provider — cannot repair without AI assistance');
        }

        const prompt = this._buildPrompt(fsh, diagnostics);

        const response = await provider.complete(prompt, {
            systemPrompt:
                'You are an expert FHIR Shorthand (FSH) debugger. ' +
                'You fix FSH syntax and structure issues based on SUSHI compiler diagnostics. ' +
                'You output ONLY corrected FSH — no explanations, no markdown fences.',
            temperature: 0.2,
        });

        const correctedFsh = this._stripMarkdownFences(response.content);
        return correctedFsh;
    }

    /**
     * Build the LLM prompt from failing FSH and its Diagnostics.
     *
     * @param {string} fsh - The failing FSH
     * @param {import('../models/diagnostic').Diagnostic[]} diagnostics - Structured Diagnostics
     * @returns {string}
     */
    _buildPrompt(fsh, diagnostics) {
        const formattedDiagnostics = diagnostics
            .map(d => d.toString())
            .join('\n');

        return [
            'The following FHIR Shorthand (FSH) failed to compile with SUSHI.',
            'Fix ONLY the issues identified in the Diagnostics below.',
            '',
            'Failing FSH:',
            '---',
            fsh,
            '---',
            '',
            'SUSHI Diagnostics:',
            '---',
            formattedDiagnostics,
            '---',
            '',
            'Instructions:',
            '- Fix ONLY the issues identified in the Diagnostics above',
            '- Do NOT re-architect the Profile Design — only fix syntax and structure issues',
            '- Preserve the intent of the original FSH (same profile name, same constraints)',
            '- Output ONLY the corrected FSH — no markdown fences, no explanations, no commentary',
        ].join('\n');
    }

    /**
     * Strip any accidental markdown fences from the LLM response.
     *
     * @param {string} content - Raw LLM response
     * @returns {string} Clean FSH content
     */
    _stripMarkdownFences(content) {
        let cleaned = content.trim();

        // Remove opening fence (with optional language tag)
        cleaned = cleaned.replace(/^```(?:fsh|FSH)?\s*\n?/, '');

        // Remove closing fence
        cleaned = cleaned.replace(/\n?```\s*$/, '');

        return cleaned.trim();
    }
}

module.exports = RepairAgent;
