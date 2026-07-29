/**
 * ACP Provider — connects to an LLM via Agent Communication Protocol
 * through Kiro CLI.
 *
 * Currently a stub: ACP integration is not yet available at runtime.
 * When called, it throws a clear error explaining the situation.
 * The static `isAvailable()` method returns false until ACP is wired.
 */
const LlmProvider = require('./llmProvider');

class AcpProvider extends LlmProvider {

    /**
     * Check whether the ACP connection is available.
     * Returns false until Kiro CLI ACP integration is live.
     *
     * @returns {boolean}
     */
    static isAvailable() {
        // TODO: Check for live ACP connection via Kiro CLI
        return false;
    }

    /**
     * Request a completion via ACP.
     *
     * @param {string} prompt - The user/task prompt to send.
     * @param {object} [options] - Generation parameters (maxTokens, temperature, systemPrompt).
     * @returns {Promise<{content: string, model: string, usage: {promptTokens: number, completionTokens: number}}>}
     * @throws {Error} Always throws until ACP integration is connected.
     */
    async complete(prompt, options = {}) {
        if (!AcpProvider.isAvailable()) {
            throw new Error(
                'ACP Provider not yet connected — awaiting Kiro CLI ACP integration'
            );
        }

        // Future: send prompt + options over ACP and return the completion.
        // const response = await acpClient.complete(prompt, options);
        // return {
        //     content: response.content,
        //     model: response.model,
        //     usage: {
        //         promptTokens: response.usage.promptTokens,
        //         completionTokens: response.usage.completionTokens,
        //     },
        // };
    }
}

module.exports = AcpProvider;
