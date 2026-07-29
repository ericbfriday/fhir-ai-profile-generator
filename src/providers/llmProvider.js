/**
 * LLM Provider — base class defining the stable interface that Agents call
 * for LLM completions.
 *
 * The Provider encapsulates model/vendor selection strategy so that Agents
 * never call an LLM directly. Concrete implementations (e.g. ACP Provider)
 * extend this class and implement the `complete` method.
 *
 * Contract:
 *   async complete(prompt, options) → { content, model, usage }
 *   static isAvailable() → boolean
 */
class LlmProvider {

    /**
     * Request a completion from the LLM.
     *
     * @param {string} prompt - The user/task prompt to send.
     * @param {object} [options] - Optional generation parameters.
     * @param {number} [options.maxTokens] - Maximum tokens in the response.
     * @param {number} [options.temperature] - Sampling temperature (0–1).
     * @param {string} [options.systemPrompt] - System-level instructions.
     * @returns {Promise<{content: string, model: string, usage: {promptTokens: number, completionTokens: number}}>}
     */
    async complete(prompt, options = {}) {
        throw new Error(
            `${this.constructor.name} does not implement complete(). ` +
            'Subclasses must override this method.'
        );
    }

    /**
     * Check whether this provider is available for use.
     * Concrete implementations override this to report actual availability.
     *
     * @returns {boolean}
     */
    static isAvailable() {
        return false;
    }
}

module.exports = LlmProvider;
