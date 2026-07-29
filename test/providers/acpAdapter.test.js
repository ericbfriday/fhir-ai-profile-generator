import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

describe('AcpAdapter', () => {
    let AcpAdapter, AcpTimeoutError, AcpAuthError;
    let mockProcess;
    let mockSpawn;

    function createMockProcess() {
        const proc = new EventEmitter();
        proc.stdin = { write: vi.fn(), end: vi.fn() };
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        proc.kill = vi.fn();
        proc.pid = 12345;
        return proc;
    }

    /**
     * Simulate the ACP subprocess responding with a JSON-RPC message.
     */
    function sendResponse(proc, message) {
        const line = JSON.stringify(message) + '\n';
        proc.stdout.emit('data', Buffer.from(line));
    }

    /**
     * Set up mock to respond to JSON-RPC requests via process.nextTick.
     */
    function setupAutoResponder(proc, responseMap) {
        proc.stdin.write.mockImplementation((data) => {
            const lines = data.toString().split('\n').filter(Boolean);
            for (const line of lines) {
                const request = JSON.parse(line);
                if (request.method && responseMap[request.method]) {
                    const handler = responseMap[request.method];
                    process.nextTick(() => handler(proc, request));
                }
            }
        });
    }

    /**
     * Standard happy-path responder that handles init, session/new, and prompt with chunks+TurnEnd.
     */
    function setupHappyPath(proc, opts = {}) {
        const sessionId = opts.sessionId || 'sess-abc-123';
        const chunks = opts.chunks || [{ text: 'Hello ' }, { text: 'World' }];

        setupAutoResponder(proc, {
            initialize: (p, req) => {
                sendResponse(p, {
                    jsonrpc: '2.0',
                    id: req.id,
                    result: { protocolVersion: 1, serverCapabilities: {} },
                });
            },
            'session/new': (p, req) => {
                sendResponse(p, {
                    jsonrpc: '2.0',
                    id: req.id,
                    result: { sessionId },
                });
            },
            'session/prompt': (p, req) => {
                sendResponse(p, {
                    jsonrpc: '2.0',
                    id: req.id,
                    result: { accepted: true },
                });
                // Send chunks then TurnEnd
                for (const chunk of chunks) {
                    sendResponse(p, {
                        jsonrpc: '2.0',
                        method: 'session/notification',
                        params: {
                            sessionId,
                            type: 'AgentMessageChunk',
                            data: chunk,
                        },
                    });
                }
                sendResponse(p, {
                    jsonrpc: '2.0',
                    method: 'session/notification',
                    params: { sessionId, type: 'TurnEnd', data: {} },
                });
            },
        });
    }

    beforeEach(async () => {
        mockProcess = createMockProcess();
        mockSpawn = vi.fn().mockReturnValue(mockProcess);

        const mod = await import('../../src/providers/acpAdapter.js');
        AcpAdapter = mod.AcpAdapter;
        AcpTimeoutError = mod.AcpTimeoutError;
        AcpAuthError = mod.AcpAuthError;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.resetModules();
    });

    describe('constructor', () => {
        it('stores command and args', () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });
            expect(adapter).toBeDefined();
        });

        it('accepts options with timeout and env', () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], {
                timeout: 60000,
                env: { CUSTOM: 'value' },
                spawn: mockSpawn,
            });
            expect(adapter).toBeDefined();
        });
    });

    describe('complete() — successful flow', () => {
        it('spawns subprocess, initializes, creates session, sends prompt, and returns concatenated response', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });
            setupHappyPath(mockProcess);

            const result = await adapter.complete('Generate a profile');

            expect(result).toEqual({
                content: 'Hello World',
                model: 'acp:unknown',
                usage: { promptTokens: 0, completionTokens: 0 },
            });

            // Verify spawn was called correctly
            expect(mockSpawn).toHaveBeenCalledWith('kiro', ['--acp'], expect.objectContaining({
                stdio: ['pipe', 'pipe', 'pipe'],
            }));

            adapter.dispose();
        });

        it('uses custom model name from constructor options', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], {
                model: 'claude-sonnet',
                spawn: mockSpawn,
            });
            setupHappyPath(mockProcess, { chunks: [{ text: 'Done' }] });

            const result = await adapter.complete('Hello');

            expect(result.model).toBe('acp:claude-sonnet');
            adapter.dispose();
        });

        it('sends correct initialize params', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });

            let initializeParams;
            setupAutoResponder(mockProcess, {
                initialize: (proc, req) => {
                    initializeParams = req.params;
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { protocolVersion: 1, serverCapabilities: {} },
                    });
                },
                'session/new': (proc, req) => {
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { sessionId: 'sess-123' },
                    });
                },
                'session/prompt': (proc, req) => {
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { accepted: true },
                    });
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        method: 'session/notification',
                        params: { sessionId: 'sess-123', type: 'TurnEnd', data: {} },
                    });
                },
            });

            await adapter.complete('test');

            expect(initializeParams).toEqual({
                protocolVersion: 1,
                clientCapabilities: {},
                clientInfo: { name: 'fhir-ai-pipeline', version: '1.0.0' },
            });

            adapter.dispose();
        });

        it('sends correct session/new params', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });

            let sessionNewParams;
            setupAutoResponder(mockProcess, {
                initialize: (proc, req) => {
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { protocolVersion: 1, serverCapabilities: {} },
                    });
                },
                'session/new': (proc, req) => {
                    sessionNewParams = req.params;
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { sessionId: 'sess-123' },
                    });
                },
                'session/prompt': (proc, req) => {
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { accepted: true },
                    });
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        method: 'session/notification',
                        params: { sessionId: 'sess-123', type: 'TurnEnd', data: {} },
                    });
                },
            });

            await adapter.complete('test');

            expect(sessionNewParams).toEqual({
                cwd: process.cwd(),
                mcpServers: [],
            });

            adapter.dispose();
        });

        it('sends correct session/prompt params', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });

            let promptParams;
            setupAutoResponder(mockProcess, {
                initialize: (proc, req) => {
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { protocolVersion: 1, serverCapabilities: {} },
                    });
                },
                'session/new': (proc, req) => {
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { sessionId: 'sess-123' },
                    });
                },
                'session/prompt': (proc, req) => {
                    promptParams = req.params;
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { accepted: true },
                    });
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        method: 'session/notification',
                        params: { sessionId: 'sess-123', type: 'TurnEnd', data: {} },
                    });
                },
            });

            await adapter.complete('Generate a FHIR profile');

            expect(promptParams).toEqual({
                sessionId: 'sess-123',
                content: [{ type: 'text', text: 'Generate a FHIR profile' }],
            });

            adapter.dispose();
        });
    });

    describe('complete() — timeout', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('throws AcpTimeoutError when response takes longer than configured timeout', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], {
                timeout: 5000,
                spawn: mockSpawn,
            });

            // Never respond — simulates hang
            mockProcess.stdin.write.mockImplementation(() => {});

            const resultPromise = adapter.complete('test');

            // Advance time past the timeout
            vi.advanceTimersByTime(5001);

            await expect(resultPromise).rejects.toThrow(AcpTimeoutError);

            adapter.dispose();
        });

        it('uses default timeout of 120s', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });

            mockProcess.stdin.write.mockImplementation(() => {});

            const resultPromise = adapter.complete('test');

            // Advance past 120s
            vi.advanceTimersByTime(120001);

            await expect(resultPromise).rejects.toThrow(AcpTimeoutError);

            adapter.dispose();
        });
    });

    describe('complete() — process crash', () => {
        it('rejects when subprocess exits with non-zero code', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });

            mockProcess.stdin.write.mockImplementation(() => {
                // Process crashes after receiving the first message
                process.nextTick(() => {
                    mockProcess.emit('close', 1, null);
                });
            });

            await expect(adapter.complete('test')).rejects.toThrow(/process exited/i);

            adapter.dispose();
        });

        it('rejects when subprocess emits error event', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });

            mockProcess.stdin.write.mockImplementation(() => {
                process.nextTick(() => {
                    mockProcess.emit('error', new Error('spawn ENOENT'));
                });
            });

            await expect(adapter.complete('test')).rejects.toThrow(/ENOENT|spawn/i);

            adapter.dispose();
        });
    });

    describe('complete() — auth error', () => {
        it('throws AcpAuthError when initialize returns auth error', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });

            setupAutoResponder(mockProcess, {
                initialize: (proc, req) => {
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        error: { code: -32001, message: 'Authentication failed' },
                    });
                },
            });

            await expect(adapter.complete('test')).rejects.toThrow(AcpAuthError);
            adapter.dispose();
        });

        it('throws AcpAuthError with descriptive message', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });

            setupAutoResponder(mockProcess, {
                initialize: (proc, req) => {
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        error: { code: -32001, message: 'Authentication failed' },
                    });
                },
            });

            await expect(adapter.complete('test')).rejects.toThrow(/auth/i);
            adapter.dispose();
        });

        it('throws AcpAuthError when error code indicates unauthorized', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });

            setupAutoResponder(mockProcess, {
                initialize: (proc, req) => {
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        error: { code: 401, message: 'Unauthorized' },
                    });
                },
            });

            await expect(adapter.complete('test')).rejects.toThrow(AcpAuthError);
            adapter.dispose();
        });
    });

    describe('session reuse', () => {
        it('reuses existing session on second complete() call without re-initializing', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });
            const methodCalls = [];

            setupAutoResponder(mockProcess, {
                initialize: (proc, req) => {
                    methodCalls.push('initialize');
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { protocolVersion: 1, serverCapabilities: {} },
                    });
                },
                'session/new': (proc, req) => {
                    methodCalls.push('session/new');
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { sessionId: 'sess-reuse' },
                    });
                },
                'session/prompt': (proc, req) => {
                    methodCalls.push('session/prompt');
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        id: req.id,
                        result: { accepted: true },
                    });
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        method: 'session/notification',
                        params: {
                            sessionId: 'sess-reuse',
                            type: 'AgentMessageChunk',
                            data: { text: 'response' },
                        },
                    });
                    sendResponse(proc, {
                        jsonrpc: '2.0',
                        method: 'session/notification',
                        params: {
                            sessionId: 'sess-reuse',
                            type: 'TurnEnd',
                            data: {},
                        },
                    });
                },
            });

            // First call — should init + session/new + session/prompt
            const result1 = await adapter.complete('first prompt');
            expect(result1.content).toBe('response');

            expect(methodCalls).toContain('initialize');
            expect(methodCalls).toContain('session/new');
            expect(methodCalls).toContain('session/prompt');

            // Reset tracking
            methodCalls.length = 0;

            // Second call — should only send session/prompt
            const result2 = await adapter.complete('second prompt');
            expect(result2.content).toBe('response');

            // Should NOT have re-initialized or created a new session
            expect(methodCalls).not.toContain('initialize');
            expect(methodCalls).not.toContain('session/new');
            expect(methodCalls).toContain('session/prompt');

            // spawn should only have been called once
            expect(mockSpawn).toHaveBeenCalledTimes(1);

            adapter.dispose();
        });
    });

    describe('dispose()', () => {
        it('kills the subprocess', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });
            setupHappyPath(mockProcess);

            await adapter.complete('test');

            adapter.dispose();
            expect(mockProcess.kill).toHaveBeenCalled();
        });

        it('is safe to call before any complete() call', () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });
            expect(() => adapter.dispose()).not.toThrow();
        });

        it('is safe to call multiple times', async () => {
            const adapter = new AcpAdapter('kiro', ['--acp'], { spawn: mockSpawn });
            setupHappyPath(mockProcess);

            await adapter.complete('test');

            adapter.dispose();
            expect(() => adapter.dispose()).not.toThrow();
        });
    });

    describe('environment passing', () => {
        it('passes custom env to subprocess', async () => {
            const customEnv = { MY_TOKEN: 'secret123' };
            const adapter = new AcpAdapter('kiro', ['--acp'], {
                env: customEnv,
                spawn: mockSpawn,
            });
            setupHappyPath(mockProcess);

            await adapter.complete('test');

            expect(mockSpawn).toHaveBeenCalledWith('kiro', ['--acp'], expect.objectContaining({
                env: expect.objectContaining({ MY_TOKEN: 'secret123' }),
            }));

            adapter.dispose();
        });
    });
});
