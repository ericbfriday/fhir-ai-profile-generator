/**
 * OpenRouter Provider — connects to any model via the OpenRouter unified API.
 *
 * Requires OPENROUTER_API_KEY environment variable to be set.
 * Uses the openai SDK pointed at OpenRouter's base URL, with built-in retry
 * and timeout.
 *
 * OpenRouter provides access to many models (Anthropic, OpenAI, Google, Meta,
 * Mistral, etc.) through a single API key, making it an ideal fallback when
 * direct vendor keys are not available.
 */
const LlmProvider = require('./llmProvider');

class OpenRouterProvider extends LlmProvider {

    static id = 'openrouter';

    constructor() {
        super();
        const OpenAI = require('openai');
        this.client = new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
            maxRetries: 2,
            timeout: 120_000,
        });
        this.defaultModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
        this.defaultMaxTokens = parseInt(process.env.OPENROUTER_MAX_TOKENS || '4096', 10);
    }

    /**
     * Check whether the OpenRouter provider is available.
     * @returns {boolean}
     */
    static isAvailable() {
        return !!process.env.OPENROUTER_API_KEY;
    }

    /**
     * Request a completion from a model via the OpenRouter Chat Completions API.
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
                `[OpenRouterProvider] Completion failed: ${err.message}`
            );
            wrapped.cause = err;
            throw wrapped;
        }
    }
}

module.exports = OpenRouterProvider;
