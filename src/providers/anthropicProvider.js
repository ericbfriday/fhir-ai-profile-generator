/**
 * Anthropic Provider — connects to Claude via the Anthropic Messages API.
 *
 * Requires ANTHROPIC_API_KEY environment variable to be set.
 * Uses @anthropic-ai/sdk with built-in retry (2x for 429/5xx) and timeout.
 */
const LlmProvider = require('./llmProvider');

class AnthropicProvider extends LlmProvider {

    static id = 'anthropic';

    constructor() {
        super();
        const Anthropic = require('@anthropic-ai/sdk');
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
            maxRetries: 2,
            timeout: 120_000,
        });
        this.defaultModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
        this.defaultMaxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10);
    }

    /**
     * Check whether the Anthropic provider is available.
     * @returns {boolean}
     */
    static isAvailable() {
        return !!process.env.ANTHROPIC_API_KEY;
    }

    /**
     * Request a completion from Claude via the Anthropic Messages API.
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

        const params = {
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        };

        // System prompt is a top-level parameter in Anthropic's API
        if (options.systemPrompt) {
            params.system = options.systemPrompt;
        }

        // Temperature — only set if provided
        if (options.temperature !== undefined) {
            params.temperature = options.temperature;
        }

        try {
            const message = await this.client.messages.create(params);

            // Extract text from content blocks
            const content = message.content
                .filter(block => block.type === 'text')
                .map(block => block.text)
                .join('');

            return {
                content,
                model: message.model,
                usage: {
                    promptTokens: message.usage.input_tokens,
                    completionTokens: message.usage.output_tokens,
                },
            };
        } catch (err) {
            const wrapped = new Error(
                `[AnthropicProvider] Completion failed: ${err.message}`
            );
            wrapped.cause = err;
            throw wrapped;
        }
    }
}

module.exports = AnthropicProvider;
