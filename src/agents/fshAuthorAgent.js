const { getProvider } = require('../providers');

class FshAuthorAgent {

    /**
     * Author FSH from a Profile Design.
     *
     * Attempts to use the LLM Provider for authoring. If no provider is
     * available (e.g. ACP not connected), falls back to the built-in
     * string template so the Pipeline can still run end-to-end.
     *
     * @param {object} profileDesign - The Profile Design from the Architect Agent.
     * @returns {Promise<string>} Valid FSH expressing the Profile Design's Constraints.
     */
    async authorFsh(profileDesign) {
        console.log('\n\n[3/5] FSH Author Agent');

        let fsh;
        try {
            const provider = getProvider();
            fsh = await this._authorWithLlm(provider, profileDesign);
        } catch (err) {
            console.warn('[FSH Author Agent] LLM Provider unavailable — using fallback template');
            fsh = this._authorWithTemplate(profileDesign);
        }

        console.log(fsh);
        return fsh;
    }

    /**
     * Author FSH via the LLM Provider.
     *
     * @param {import('../providers/llmProvider')} provider
     * @param {object} profileDesign
     * @returns {Promise<string>}
     */
    async _authorWithLlm(provider, profileDesign) {
        const prompt = this._buildPrompt(profileDesign);
        const result = await provider.complete(prompt, {
            systemPrompt:
                'You are an expert FHIR Shorthand (FSH) author. ' +
                'You produce syntactically correct FSH that compiles cleanly with SUSHI.',
            temperature: 0.2,
        });
        return result.content;
    }

    /**
     * Build the LLM prompt from a Profile Design.
     *
     * @param {object} profileDesign
     * @returns {string}
     */
    _buildPrompt(profileDesign) {
        return [
            'Author valid FHIR Shorthand (FSH) that expresses the following Profile Design.',
            '',
            'Profile Design (JSON):',
            JSON.stringify(profileDesign, null, 2),
            '',
            'Requirements:',
            '- Use correct FSH syntax: Profile: <name>, Parent: <type>, then cardinality rules (* field min..max)',
            '- Express ALL Constraints from the Profile Design — do not omit any',
            '- Do NOT add extra constraints beyond what the Profile Design specifies',
            '- Output ONLY the FSH content — no markdown fences, no explanations, no commentary',
        ].join('\n');
    }

    /**
     * Fallback: author FSH using the original string template.
     * Used when no LLM Provider is available.
     *
     * @param {object} profileDesign
     * @returns {string}
     */
    _authorWithTemplate(profileDesign) {
        let fsh = '';
        fsh += `Profile: ${profileDesign.profileName}\n`;
        fsh += `Parent: ${profileDesign.resourceType}\n\n`;

        profileDesign.constraints.forEach(constraint => {
            const field = constraint.path.split('.')[1];
            fsh += `* ${field} ${constraint.min}..${constraint.max}\n`;
        });

        return fsh;
    }
}

module.exports = FshAuthorAgent;
