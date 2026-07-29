import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('OpenAiProvider', () => {
    let OpenAiProvider;
    let mockCreate;

    beforeEach(async () => {
        process.env.OPENAI_API_KEY = 'test-key-456';
        delete process.env.OPENAI_MODEL;
        delete process.env.OPENAI_MAX_TOKENS;

        mockCreate = vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Hello from GPT' } }],
            model: 'gpt-4o-2024-05-13',
            usage: { prompt_tokens: 15, completion_tokens: 8 },
        });

        const mod = await import('../../src/providers/openaiProvider.js');
        OpenAiProvider = mod.default;
    });

    afterEach(() => {
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_MODEL;
        delete process.env.OPENAI_MAX_TOKENS;
    });

    function createMockedProvider() {
        const provider = new OpenAiProvider();
        // Replace the real client with a mock
        provider.client = { chat: { completions: { create: mockCreate } } };
        return provider;
    }

    describe('static isAvailable()', () => {
        it('returns true when OPENAI_API_KEY is set', () => {
            process.env.OPENAI_API_KEY = 'sk-test';
            expect(OpenAiProvider.isAvailable()).toBe(true);
        });

        it('returns false when OPENAI_API_KEY is not set', () => {
            delete process.env.OPENAI_API_KEY;
            expect(OpenAiProvider.isAvailable()).toBe(false);
        });

        it('returns false when OPENAI_API_KEY is empty string', () => {
            process.env.OPENAI_API_KEY = '';
            expect(OpenAiProvider.isAvailable()).toBe(false);
        });
    });

    describe('static id', () => {
        it('has id "openai"', () => {
            expect(OpenAiProvider.id).toBe('openai');
        });
    });

    describe('complete()', () => {
        it('calls the OpenAI chat completions API with correct parameters', async () => {
            const provider = createMockedProvider();

            await provider.complete('Generate a FHIR profile', {
                systemPrompt: 'You are an expert',
                maxTokens: 2048,
                temperature: 0.7,
            });

            expect(mockCreate).toHaveBeenCalledWith({
                model: 'gpt-4o',
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
                content: 'Hello from GPT',
                model: 'gpt-4o-2024-05-13',
                usage: {
                    promptTokens: 15,
                    completionTokens: 8,
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
                model: 'gpt-4o',
                usage: { prompt_tokens: 5, completion_tokens: 0 },
            });

            const provider = createMockedProvider();
            const result = await provider.complete('Hello');

            expect(result.content).toBe('');
        });

        it('handles missing usage in response', async () => {
            mockCreate.mockResolvedValueOnce({
                choices: [{ message: { content: 'Response' } }],
                model: 'gpt-4o',
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
                '[OpenAiProvider] Completion failed: Rate limit exceeded'
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

            await provider.complete('Hello', { model: 'gpt-4-turbo' });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gpt-4-turbo' })
            );
        });
    });
});
