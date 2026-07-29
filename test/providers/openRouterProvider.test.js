import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('OpenRouterProvider', () => {
    let OpenRouterProvider;
    let mockCreate;

    beforeEach(async () => {
        process.env.OPENROUTER_API_KEY = 'sk-or-v1-test-key';
        delete process.env.OPENROUTER_MODEL;
        delete process.env.OPENROUTER_MAX_TOKENS;

        mockCreate = vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Hello from OpenRouter' } }],
            model: 'anthropic/claude-sonnet-4',
            usage: { prompt_tokens: 20, completion_tokens: 12 },
        });

        const mod = await import('../../src/providers/openRouterProvider.js');
        OpenRouterProvider = mod.default;
    });

    afterEach(() => {
        delete process.env.OPENROUTER_API_KEY;
        delete process.env.OPENROUTER_MODEL;
        delete process.env.OPENROUTER_MAX_TOKENS;
    });

    function createMockedProvider() {
        const provider = new OpenRouterProvider();
        // Replace the real client with a mock
        provider.client = { chat: { completions: { create: mockCreate } } };
        return provider;
    }

    describe('static id', () => {
        it('has id "openrouter"', () => {
            expect(OpenRouterProvider.id).toBe('openrouter');
        });
    });

    describe('static isAvailable()', () => {
        it('returns true when OPENROUTER_API_KEY is set', () => {
            process.env.OPENROUTER_API_KEY = 'sk-or-v1-test';
            expect(OpenRouterProvider.isAvailable()).toBe(true);
        });

        it('returns false when OPENROUTER_API_KEY is not set', () => {
            delete process.env.OPENROUTER_API_KEY;
            expect(OpenRouterProvider.isAvailable()).toBe(false);
        });

        it('returns false when OPENROUTER_API_KEY is empty string', () => {
            process.env.OPENROUTER_API_KEY = '';
            expect(OpenRouterProvider.isAvailable()).toBe(false);
        });
    });

    describe('constructor', () => {
        it('uses default model anthropic/claude-sonnet-4', () => {
            const provider = createMockedProvider();
            expect(provider.defaultModel).toBe('anthropic/claude-sonnet-4');
        });

        it('respects OPENROUTER_MODEL env var', () => {
            process.env.OPENROUTER_MODEL = 'google/gemini-pro';
            const provider = new OpenRouterProvider();
            expect(provider.defaultModel).toBe('google/gemini-pro');
        });

        it('uses default maxTokens of 4096', () => {
            const provider = createMockedProvider();
            expect(provider.defaultMaxTokens).toBe(4096);
        });

        it('respects OPENROUTER_MAX_TOKENS env var', () => {
            process.env.OPENROUTER_MAX_TOKENS = '8192';
            const provider = new OpenRouterProvider();
            expect(provider.defaultMaxTokens).toBe(8192);
        });
    });

    describe('complete()', () => {
        it('calls the chat completions API with correct parameters', async () => {
            const provider = createMockedProvider();

            await provider.complete('Generate a FHIR profile', {
                systemPrompt: 'You are an expert',
                maxTokens: 2048,
                temperature: 0.7,
            });

            expect(mockCreate).toHaveBeenCalledWith({
                model: 'anthropic/claude-sonnet-4',
                max_completion_tokens: 2048,
                messages: [
                    { role: 'developer', content: 'You are an expert' },
                    { role: 'user', content: 'Generate a FHIR profile' },
                ],
                temperature: 0.7,
            });
        });

        it('maps response correctly to {content, model, usage}', async () => {
            const provider = createMockedProvider();

            const result = await provider.complete('Hello');

            expect(result).toEqual({
                content: 'Hello from OpenRouter',
                model: 'anthropic/claude-sonnet-4',
                usage: {
                    promptTokens: 20,
                    completionTokens: 12,
                },
            });
        });

        it('uses default maxTokens of 4096 when not specified', async () => {
            const provider = createMockedProvider();

            await provider.complete('Hello');

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({ max_completion_tokens: 4096 })
            );
        });

        it('does not include system message when systemPrompt is not provided', async () => {
            const provider = createMockedProvider();

            await provider.complete('Hello');

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs.messages).toEqual([
                { role: 'user', content: 'Hello' },
            ]);
        });

        it('does not include temperature when not provided', async () => {
            const provider = createMockedProvider();

            await provider.complete('Hello');

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs).not.toHaveProperty('temperature');
        });

        it('handles null content in response', async () => {
            mockCreate.mockResolvedValueOnce({
                choices: [{ message: { content: null } }],
                model: 'anthropic/claude-sonnet-4',
                usage: { prompt_tokens: 5, completion_tokens: 0 },
            });

            const provider = createMockedProvider();
            const result = await provider.complete('Hello');

            expect(result.content).toBe('');
        });

        it('handles missing usage in response', async () => {
            mockCreate.mockResolvedValueOnce({
                choices: [{ message: { content: 'Response' } }],
                model: 'anthropic/claude-sonnet-4',
                usage: null,
            });

            const provider = createMockedProvider();
            const result = await provider.complete('Hello');

            expect(result.usage).toEqual({
                promptTokens: 0,
                completionTokens: 0,
            });
        });

        it('handles API errors gracefully', async () => {
            mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));

            const provider = createMockedProvider();

            await expect(provider.complete('Hello')).rejects.toThrow(
                '[OpenRouterProvider] Completion failed: Rate limit exceeded'
            );
        });

        it('wraps error with cause', async () => {
            const originalError = new Error('Network timeout');
            mockCreate.mockRejectedValueOnce(originalError);

            const provider = createMockedProvider();

            try {
                await provider.complete('Hello');
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.cause).toBe(originalError);
            }
        });

        it('allows model override via options', async () => {
            const provider = createMockedProvider();

            await provider.complete('Hello', { model: 'openai/gpt-4o' });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'openai/gpt-4o' })
            );
        });
    });
});
