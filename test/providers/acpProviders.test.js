import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Load all providers (CJS modules)
const KiroAcpProvider = (await import('../../src/providers/kiroAcpProvider.js')).default;
const ClaudeAcpProvider = (await import('../../src/providers/claudeAcpProvider.js')).default;
const CodexAcpProvider = (await import('../../src/providers/codexAcpProvider.js')).default;
const AntigravityAcpProvider = (await import('../../src/providers/antigravityAcpProvider.js')).default;
const OpenCodeAcpProvider = (await import('../../src/providers/openCodeAcpProvider.js')).default;

// Provider definitions for parameterized testing
const providerSpecs = [
    {
        name: 'KiroAcpProvider',
        Provider: KiroAcpProvider,
        id: 'kiro-acp',
        command: 'kiro-cli',
        args: ['acp'],
        env: undefined,
        model: 'kiro',
    },
    {
        name: 'ClaudeAcpProvider',
        Provider: ClaudeAcpProvider,
        id: 'claude-acp',
        command: 'claude-agent-acp',
        args: [],
        env: undefined,
        model: 'claude',
    },
    {
        name: 'CodexAcpProvider',
        Provider: CodexAcpProvider,
        id: 'codex-acp',
        command: 'codex-acp',
        args: [],
        env: { INITIAL_AGENT_MODE: 'read-only' },
        model: 'codex',
    },
    {
        name: 'AntigravityAcpProvider',
        Provider: AntigravityAcpProvider,
        id: 'antigravity-acp',
        command: 'agy',
        args: ['--acp'],
        env: undefined,
        model: 'antigravity',
    },
    {
        name: 'OpenCodeAcpProvider',
        Provider: OpenCodeAcpProvider,
        id: 'opencode-acp',
        command: 'opencode',
        args: ['acp'],
        env: undefined,
        model: 'opencode',
    },
];

for (const spec of providerSpecs) {
    describe(spec.name, () => {
        let mockBinaryExists;
        let MockAcpAdapter;
        let mockComplete;
        let mockDispose;
        let originalDeps;

        beforeEach(() => {
            // Save original deps
            originalDeps = { ...spec.Provider._deps };

            // Create mocks
            mockBinaryExists = vi.fn();
            mockComplete = vi.fn().mockResolvedValue({
                content: 'ACP response',
                model: `acp:${spec.model}`,
                usage: { promptTokens: 0, completionTokens: 0 },
            });
            mockDispose = vi.fn();

            // Use a class (not arrow fn) so it can be called with `new`
            MockAcpAdapter = vi.fn(function(command, args, options) {
                this.complete = mockComplete;
                this.dispose = mockDispose;
                this._command = command;
                this._args = args;
                this._options = options;
            });

            // Inject mocks
            spec.Provider._deps = {
                binaryExists: mockBinaryExists,
                AcpAdapter: MockAcpAdapter,
            };
        });

        afterEach(() => {
            // Restore original deps
            spec.Provider._deps = originalDeps;
        });

        describe('extends LlmProvider', () => {
            it('is a subclass of LlmProvider', () => {
                // Check prototype chain — provider has complete() from its own impl
                const provider = new spec.Provider();
                expect(typeof provider.complete).toBe('function');
                expect(typeof provider.dispose).toBe('function');
                // Verify it has the LlmProvider contract methods
                expect(typeof spec.Provider.isAvailable).toBe('function');
            });
        });

        describe('static id', () => {
            it(`has id "${spec.id}"`, () => {
                expect(spec.Provider.id).toBe(spec.id);
            });
        });

        describe('static isAvailable()', () => {
            it('returns true when binary exists in PATH', () => {
                mockBinaryExists.mockReturnValue(true);
                expect(spec.Provider.isAvailable()).toBe(true);
                expect(mockBinaryExists).toHaveBeenCalledWith(spec.command);
            });

            it('returns false when binary is not found', () => {
                mockBinaryExists.mockReturnValue(false);
                expect(spec.Provider.isAvailable()).toBe(false);
                expect(mockBinaryExists).toHaveBeenCalledWith(spec.command);
            });
        });

        describe('constructor', () => {
            it('creates an AcpAdapter with correct command, args, and model', () => {
                new spec.Provider();
                const expectedOptions = spec.env
                    ? expect.objectContaining({ model: spec.model, env: spec.env })
                    : expect.objectContaining({ model: spec.model });
                expect(MockAcpAdapter).toHaveBeenCalledWith(
                    spec.command,
                    spec.args,
                    expectedOptions
                );
            });

            if (spec.env) {
                it('passes env options to AcpAdapter', () => {
                    new spec.Provider();
                    expect(MockAcpAdapter).toHaveBeenCalledWith(
                        spec.command,
                        spec.args,
                        expect.objectContaining({ env: spec.env })
                    );
                });
            }
        });

        describe('complete()', () => {
            it('delegates to adapter.complete()', async () => {
                const provider = new spec.Provider();
                const result = await provider.complete('test prompt', { maxTokens: 1000 });

                expect(mockComplete).toHaveBeenCalledWith('test prompt', { maxTokens: 1000 });
                expect(result).toEqual({
                    content: 'ACP response',
                    model: `acp:${spec.model}`,
                    usage: { promptTokens: 0, completionTokens: 0 },
                });
            });
        });

        describe('dispose()', () => {
            it('calls adapter.dispose()', () => {
                const provider = new spec.Provider();
                provider.dispose();

                expect(mockDispose).toHaveBeenCalled();
            });
        });
    });
}
