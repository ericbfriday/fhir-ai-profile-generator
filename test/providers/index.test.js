import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('providers/index', () => {
    let getProvider;
    let providers;

    beforeEach(() => {
        vi.resetModules();

        // Clear all provider env vars
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENROUTER_API_KEY;
        delete process.env.LLM_PROVIDER;

        // Mock the SDK modules to avoid real imports
        vi.doMock('@anthropic-ai/sdk', () => {
            return {
                default: vi.fn().mockImplementation(() => ({
                    messages: { create: vi.fn() },
                })),
                __esModule: true,
            };
        });

        vi.doMock('openai', () => {
            return {
                default: vi.fn().mockImplementation(() => ({
                    chat: { completions: { create: vi.fn() } },
                })),
                __esModule: true,
            };
        });

        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENROUTER_API_KEY;
        delete process.env.LLM_PROVIDER;
        vi.restoreAllMocks();
    });

    describe('getProvider() when no provider is available', () => {
        it('throws an error explaining no provider is available', () => {
            const mod = require('../../src/providers/index');
            const originals = mod.providers.map(p => ({
                Provider: p.Provider,
                isAvailable: p.Provider.isAvailable,
            }));
            for (const entry of mod.providers) {
                entry.Provider.isAvailable = () => false;
            }
            try {
                expect(() => mod.getProvider()).toThrow('No LLM Provider is currently available');
            } finally {
                for (let i = 0; i < mod.providers.length; i++) {
                    mod.providers[i].Provider.isAvailable = originals[i].isAvailable;
                }
            }
        });

        it('error message includes setup instructions for API keys', () => {
            const mod = require('../../src/providers/index');
            const originals = mod.providers.map(p => ({
                Provider: p.Provider,
                isAvailable: p.Provider.isAvailable,
            }));
            for (const entry of mod.providers) {
                entry.Provider.isAvailable = () => false;
            }
            try {
                mod.getProvider();
            } catch (err) {
                expect(err.message).toContain('ANTHROPIC_API_KEY');
                expect(err.message).toContain('OPENAI_API_KEY');
                expect(err.message).toContain('OPENROUTER_API_KEY');
            } finally {
                for (let i = 0; i < mod.providers.length; i++) {
                    mod.providers[i].Provider.isAvailable = originals[i].isAvailable;
                }
            }
        });

        it('error message mentions ACP agents', () => {
            const mod = require('../../src/providers/index');
            const originals = mod.providers.map(p => ({
                Provider: p.Provider,
                isAvailable: p.Provider.isAvailable,
            }));
            for (const entry of mod.providers) {
                entry.Provider.isAvailable = () => false;
            }
            try {
                mod.getProvider();
            } catch (err) {
                expect(err.message).toContain('ACP agent');
            } finally {
                for (let i = 0; i < mod.providers.length; i++) {
                    mod.providers[i].Provider.isAvailable = originals[i].isAvailable;
                }
            }
        });
    });

    describe('providers array', () => {
        it('has eight registered providers', () => {
            const mod = require('../../src/providers/index');
            expect(mod.providers).toHaveLength(8);
        });

        it('has Provider class with isAvailable in each entry', () => {
            const mod = require('../../src/providers/index');
            for (const entry of mod.providers) {
                expect(entry.Provider).toBeDefined();
                expect(typeof entry.Provider.isAvailable).toBe('function');
            }
        });

        it('ACP providers are first (indices 0-4)', () => {
            const mod = require('../../src/providers/index');
            const ids = mod.providers.map(p => p.Provider.id);
            expect(ids[0]).toBe('kiro-acp');
            expect(ids[1]).toBe('claude-acp');
            expect(ids[2]).toBe('codex-acp');
            expect(ids[3]).toBe('antigravity-acp');
            expect(ids[4]).toBe('opencode-acp');
        });

        it('API key providers follow ACP providers', () => {
            const mod = require('../../src/providers/index');
            const ids = mod.providers.map(p => p.Provider.id);
            expect(ids[5]).toBe('anthropic');
            expect(ids[6]).toBe('openai');
        });

        it('OpenRouter is last', () => {
            const mod = require('../../src/providers/index');
            const ids = mod.providers.map(p => p.Provider.id);
            expect(ids[7]).toBe('openrouter');
            expect(ids[ids.length - 1]).toBe('openrouter');
        });
    });

    describe('provider priority - tier ordering', () => {
        it('ACP providers are checked before API key providers', () => {
            process.env.ANTHROPIC_API_KEY = 'test-key';
            const mod = require('../../src/providers/index');
            // Make kiro-acp available via _deps
            const KiroAcp = mod.providers[0].Provider;
            const origDeps = KiroAcp._deps;
            KiroAcp._deps = { ...origDeps, binaryExists: () => true };
            try {
                const provider = mod.getProvider();
                expect(provider.constructor.id).toBe('kiro-acp');
            } finally {
                KiroAcp._deps = origDeps;
            }
        });

        it('returns Anthropic when no ACP binary available and ANTHROPIC_API_KEY is set', () => {
            process.env.ANTHROPIC_API_KEY = 'test-key';
            const mod = require('../../src/providers/index');
            const provider = mod.getProvider();
            expect(provider.constructor.id).toBe('anthropic');
        });

        it('returns OpenAI when only OPENAI_API_KEY is set', () => {
            process.env.OPENAI_API_KEY = 'test-key';
            const mod = require('../../src/providers/index');
            const provider = mod.getProvider();
            expect(provider.constructor.id).toBe('openai');
        });

        it('returns Anthropic over OpenAI when both keys are set', () => {
            process.env.ANTHROPIC_API_KEY = 'test-key';
            process.env.OPENAI_API_KEY = 'test-key';
            const mod = require('../../src/providers/index');
            const provider = mod.getProvider();
            expect(provider.constructor.id).toBe('anthropic');
        });

        it('returns OpenRouter when only OPENROUTER_API_KEY is set', () => {
            process.env.OPENROUTER_API_KEY = 'sk-or-v1-test';
            const mod = require('../../src/providers/index');
            const provider = mod.getProvider();
            expect(provider.constructor.id).toBe('openrouter');
        });

        it('returns Anthropic over OpenRouter when both keys are set', () => {
            process.env.ANTHROPIC_API_KEY = 'test-key';
            process.env.OPENROUTER_API_KEY = 'sk-or-v1-test';
            const mod = require('../../src/providers/index');
            const provider = mod.getProvider();
            expect(provider.constructor.id).toBe('anthropic');
        });
    });

    describe('LLM_PROVIDER override', () => {
        it('forces OpenAI when LLM_PROVIDER=openai and key is set', () => {
            process.env.ANTHROPIC_API_KEY = 'test-key';
            process.env.OPENAI_API_KEY = 'test-key';
            process.env.LLM_PROVIDER = 'openai';
            const mod = require('../../src/providers/index');
            const provider = mod.getProvider();
            expect(provider.constructor.id).toBe('openai');
        });

        it('forces OpenRouter when LLM_PROVIDER=openrouter and key is set', () => {
            process.env.ANTHROPIC_API_KEY = 'test-key';
            process.env.OPENROUTER_API_KEY = 'sk-or-v1-test';
            process.env.LLM_PROVIDER = 'openrouter';
            const mod = require('../../src/providers/index');
            const provider = mod.getProvider();
            expect(provider.constructor.id).toBe('openrouter');
        });

        it('forces kiro-acp when LLM_PROVIDER=kiro-acp and binary is available', () => {
            process.env.LLM_PROVIDER = 'kiro-acp';
            const mod = require('../../src/providers/index');
            // Make kiro-acp available via _deps
            const KiroAcp = mod.providers[0].Provider;
            const origDeps = KiroAcp._deps;
            KiroAcp._deps = { ...origDeps, binaryExists: () => true };
            try {
                const provider = mod.getProvider();
                expect(provider.constructor.id).toBe('kiro-acp');
            } finally {
                KiroAcp._deps = origDeps;
            }
        });

        it('throws when LLM_PROVIDER is set but provider is not available', () => {
            process.env.LLM_PROVIDER = 'anthropic';
            // No ANTHROPIC_API_KEY set
            const mod = require('../../src/providers/index');
            expect(() => mod.getProvider()).toThrow('not available');
        });

        it('throws when LLM_PROVIDER is an unknown value', () => {
            process.env.LLM_PROVIDER = 'unknown-provider';
            const mod = require('../../src/providers/index');
            expect(() => mod.getProvider()).toThrow('Unknown LLM_PROVIDER');
        });
    });

    describe('getProvider() logging', () => {
        it('logs the selected provider name on success', () => {
            process.env.ANTHROPIC_API_KEY = 'test-key';
            const mod = require('../../src/providers/index');
            mod.getProvider();
            expect(console.log).toHaveBeenCalledWith('[Provider] Using: Anthropic (Claude)');
        });

        it('logs when using forced provider', () => {
            process.env.OPENAI_API_KEY = 'test-key';
            process.env.LLM_PROVIDER = 'openai';
            const mod = require('../../src/providers/index');
            mod.getProvider();
            expect(console.log).toHaveBeenCalledWith('[Provider] Using: OpenAI (GPT)');
        });
    });

    describe('getProvider() returns functional provider instance', () => {
        it('returns an instance with complete() method', () => {
            process.env.ANTHROPIC_API_KEY = 'test-key';
            const mod = require('../../src/providers/index');
            const provider = mod.getProvider();
            expect(typeof provider.complete).toBe('function');
        });
    });
});
