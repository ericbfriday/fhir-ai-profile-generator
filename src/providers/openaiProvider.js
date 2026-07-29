/**
 * OpenAI Provider — connects to GPT models via the OpenAI Chat Completions API.
 *
 * Requires OPENAI_API_KEY environment variable to be set.
 * Uses the openai SDK with built-in retry (2x for 429/5xx) and timeout.
 */
const LlmProvider = require('./llmProvider');

class OpenAiProvider extends LlmProvider {

    static id = 'openai';

    constructor() {
        super();
        const OpenAI = require('openai');
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            maxRetries: 2,
            timeout: 120_000,
        });
        this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4o';
        this.defaultMaxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '4096', 10);
    }

    /**
     * Check whether the OpenAI provider is available.
     * @returns {boolean}
     */
    static isAvailable() {
        return !!process.env.OPENAI_API_KEY;
    }

    /**
     * Request a completion from GPT via the OpenAI Chat Completions API.
     *
     * @param {string} prompt - The user prompt to send.
     * @param {object} [options] - Generation parameters.
     * @param {number} [options.maxTokens] - Maximum tokens in the response.
     * @param {number} [options.temperature] - Sampling temperature (0–1).
     * @param {string} [options.systemPrompt] - System-level instructions.
     * @param {string} [options.model] - Model override.
     * @returns {Promise<{content: string, model: string, usage: {promptTokens: number, completionTokens: number}}>}
     */
    async complete(prompt, options = {}) {
        const model = options.model || this.defaultModel;
        const maxTokens = options.maxTokens || this.defaultMaxTokens;

        const messages = [];

        // OpenAI uses a "developer" role for system instructions
        if (options.systemPrompt) {
            messages.push({ role: 'developer', content: options.systemPrompt });
        }

        messages.push({ role: 'user', content: prompt });

        const params = {
            model,
            max_completion_tokens: maxTokens,
            messages,
        };

        if (options.temperature !== undefined) {
            params.temperature = options.temperature;
        }

        try {
            const completion = await this.client.chat.completions.create(params);

            const choice = completion.choices[0];
            return {
                content: choice.message.content || '',
                model: completion.model,
                usage: {
                    promptTokens: completion.usage?.prompt_tokens || 0,
                    completionTokens: completion.usage?.completion_tokens || 0,
                },
            };
        } catch (err) {
            const wrapped = new Error(
                `[OpenAiProvider] Completion failed: ${err.message}`
            );
            wrapped.cause = err;
            throw wrapped;
        }
    }
}

module.exports = OpenAiProvider;
