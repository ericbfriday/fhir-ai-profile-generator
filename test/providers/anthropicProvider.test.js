import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('AnthropicProvider', () => {
    let AnthropicProvider;
    let mockCreate;

    beforeEach(async () => {
        process.env.ANTHROPIC_API_KEY = 'test-key-123';
        delete process.env.ANTHROPIC_MODEL;
        delete process.env.ANTHROPIC_MAX_TOKENS;

        mockCreate = vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Hello from Claude' }],
            model: 'claude-sonnet-4-20250514',
            usage: { input_tokens: 10, output_tokens: 5 },
        });

        const mod = await import('../../src/providers/anthropicProvider.js');
        AnthropicProvider = mod.default;
    });

    afterEach(() => {
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.ANTHROPIC_MODEL;
        delete process.env.ANTHROPIC_MAX_TOKENS;
    });

    function createMockedProvider() {
        const provider = new AnthropicProvider();
        // Replace the real client with a mock
        provider.client = { messages: { create: mockCreate } };
        return provider;
    }

    describe('static isAvailable()', () => {
        it('returns true when ANTHROPIC_API_KEY is set', () => {
            process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
            expect(AnthropicProvider.isAvailable()).toBe(true);
        });

        it('returns false when ANTHROPIC_API_KEY is not set', () => {
            delete process.env.ANTHROPIC_API_KEY;
            expect(AnthropicProvider.isAvailable()).toBe(false);
        });

        it('returns false when ANTHROPIC_API_KEY is empty string', () => {
            process.env.ANTHROPIC_API_KEY = '';
            expect(AnthropicProvider.isAvailable()).toBe(false);
        });
    });

    describe('static id', () => {
        it('has id "anthropic"', () => {
            expect(AnthropicProvider.id).toBe('anthropic');
        });
    });

    describe('complete()', () => {
        it('calls the Anthropic messages API with correct parameters', async () => {
            const provider = createMockedProvider();

            await provider.complete('Generate a FHIR profile', {
                systemPrompt: 'You are an expert',
                maxTokens: 2048,
                temperature: 0.5,
            });

            expect(mockCreate).toHaveBeenCalledWith({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [{ role: 'user', content: 'Generate a FHIR profile' }],
                system: 'You are an expert',
                temperature: 0.5,
            });
        });

        it('maps response correctly to {content, model, usage}', async () => {
            const provider = createMockedProvider();

            const result = await provider.complete('Hello');

            expect(result).toEqual({
                content: 'Hello from Claude',
                model: 'claude-sonnet-4-20250514',
                usage: {
                    promptTokens: 10,
                    completionTokens: 5,
                },
            });
        });

        it('uses default maxTokens of 4096 when not specified', async () => {
            const provider = createMockedProvider();

            await provider.complete('Hello');

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({ max_tokens: 4096 })
            );
        });

        it('does not include system param when systemPrompt is not provided', async () => {
            const provider = createMockedProvider();

            await provider.complete('Hello');

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs).not.toHaveProperty('system');
        });

        it('does not include temperature when not provided', async () => {
            const provider = createMockedProvider();

            await provider.complete('Hello');

            const callArgs = mockCreate.mock.calls[0][0];
            expect(callArgs).not.toHaveProperty('temperature');
        });

        it('concatenates multiple text blocks', async () => {
            mockCreate.mockResolvedValueOnce({
                content: [
                    { type: 'text', text: 'Part 1' },
                    { type: 'text', text: ' Part 2' },
                ],
                model: 'claude-sonnet-4-20250514',
                usage: { input_tokens: 5, output_tokens: 10 },
            });

            const provider = createMockedProvider();
            const result = await provider.complete('Hello');

            expect(result.content).toBe('Part 1 Part 2');
        });

        it('filters out non-text content blocks', async () => {
            mockCreate.mockResolvedValueOnce({
                content: [
                    { type: 'text', text: 'Only text' },
                    { type: 'tool_use', id: 'test', name: 'tool', input: {} },
                ],
                model: 'claude-sonnet-4-20250514',
                usage: { input_tokens: 5, output_tokens: 10 },
            });

            const provider = createMockedProvider();
            const result = await provider.complete('Hello');

            expect(result.content).toBe('Only text');
        });

        it('handles API errors gracefully', async () => {
            mockCreate.mockRejectedValueOnce(new Error('Rate limit exceeded'));

            const provider = createMockedProvider();

            await expect(provider.complete('Hello')).rejects.toThrow(
                '[AnthropicProvider] Completion failed: Rate limit exceeded'
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

            await provider.complete('Hello', { model: 'claude-opus-4-20250514' });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'claude-opus-4-20250514' })
            );
        });
    });
});
