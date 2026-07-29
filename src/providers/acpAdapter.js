/**
 * ACP Adapter — shared transport layer for JSON-RPC 2.0 communication
 * with ACP (Agent Communication Protocol) subprocesses over stdio.
 *
 * Manages the lifecycle of an ACP agent subprocess:
 * - Spawns on first complete() call
 * - Keeps alive for reuse across multiple prompts
 * - Kills on dispose()
 *
 * Protocol flow:
 *   initialize → session/new → session/prompt → notifications → TurnEnd
 */
const { spawn: defaultSpawn } = require('child_process');

// --- Typed Errors ---

class AcpTimeoutError extends Error {
    constructor(timeoutMs) {
        super(`ACP request timeout after ${timeoutMs}ms`);
        this.name = 'AcpTimeoutError';
    }
}

class AcpAuthError extends Error {
    constructor(message) {
        super(`ACP authentication failed: ${message}`);
        this.name = 'AcpAuthError';
    }
}

// Auth-related error codes
const AUTH_ERROR_CODES = [-32001, 401, 403];

// --- AcpAdapter ---

class AcpAdapter {
    /**
     * @param {string} command - Command to spawn (e.g. 'kiro')
     * @param {string[]} args - Arguments for the command
     * @param {object} [options]
     * @param {number} [options.timeout=120000] - Request timeout in ms
     * @param {object} [options.env] - Additional environment variables
     * @param {string} [options.model] - Provider ID for model field
     * @param {Function} [options.spawn] - Override spawn for testing
     */
    constructor(command, args = [], options = {}) {
        this._command = command;
        this._args = args;
        this._timeout = options.timeout || 120000;
        this._env = options.env || {};
        this._model = options.model || 'unknown';
        this._spawn = options.spawn || defaultSpawn;

        this._process = null;
        this._sessionId = null;
        this._initialized = false;
        this._nextId = 1;
        this._pendingRequests = new Map(); // id → {resolve, reject}
        this._buffer = '';
        this._notificationHandlers = []; // [handler, ...]
        this._activeTimers = new Set();
    }

    /**
     * Send a prompt to the ACP agent and return the completed response.
     *
     * @param {string} prompt - The text prompt to send
     * @param {object} [options] - Reserved for future use
     * @returns {Promise<{content: string, model: string, usage: {promptTokens: number, completionTokens: number}}>}
     */
    async complete(prompt, options = {}) {
        // Ensure subprocess is running and initialized
        if (!this._initialized) {
            await this._ensureReady();
        }

        // Send prompt and collect response chunks
        const content = await this._sendPrompt(prompt);

        return {
            content,
            model: `acp:${this._model}`,
            usage: { promptTokens: 0, completionTokens: 0 },
        };
    }

    /**
     * Kill the subprocess and clean up resources.
     */
    dispose() {
        // Clear all active timeout timers
        for (const timer of this._activeTimers) {
            clearTimeout(timer);
        }
        this._activeTimers.clear();

        if (this._process) {
            this._process.kill();
            this._process = null;
        }
        this._sessionId = null;
        this._initialized = false;
        this._pendingRequests.clear();
        this._notificationHandlers = [];
    }

    // --- Private Methods ---

    /**
     * Spawn the subprocess and perform the initialize + session/new handshake.
     */
    async _ensureReady() {
        this._spawnProcess();
        await this._initialize();
        await this._createSession();
        this._initialized = true;
    }

    /**
     * Spawn the ACP subprocess.
     */
    _spawnProcess() {
        if (this._process) return;

        const env = { ...process.env, ...this._env };
        this._process = this._spawn(this._command, this._args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
        });

        // Handle stdout line-by-line (newline-delimited JSON)
        this._process.stdout.on('data', (chunk) => {
            this._buffer += chunk.toString();
            this._processBuffer();
        });

        // Handle process errors and exit
        this._process.on('error', (err) => {
            this._rejectAll(err);
        });

        this._process.on('close', (code, signal) => {
            if (code !== 0 && code !== null) {
                this._rejectAll(new Error(`ACP process exited with code ${code}`));
            } else if (signal) {
                this._rejectAll(new Error(`ACP process closed by signal ${signal}`));
            }
            this._process = null;
            this._initialized = false;
            this._sessionId = null;
        });
    }

    /**
     * Process buffered stdout data, extracting complete JSON lines.
     */
    _processBuffer() {
        const lines = this._buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        this._buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const message = JSON.parse(line);
                this._handleMessage(message);
            } catch (e) {
                // Ignore malformed lines
            }
        }
    }

    /**
     * Route an incoming JSON-RPC message to the appropriate handler.
     */
    _handleMessage(message) {
        // Response to a request (has id, has result or error)
        if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
            const pending = this._pendingRequests.get(message.id);
            if (pending) {
                this._pendingRequests.delete(message.id);
                if (message.error) {
                    const err = this._createErrorFromRpc(message.error);
                    pending.reject(err);
                } else {
                    pending.resolve(message.result);
                }
            }
            return;
        }

        // Notification (has method, no id)
        if (message.method === 'session/notification' && message.params) {
            for (const handler of this._notificationHandlers) {
                handler(message.params);
            }
        }
    }

    /**
     * Create an appropriate error from a JSON-RPC error object.
     */
    _createErrorFromRpc(rpcError) {
        if (AUTH_ERROR_CODES.includes(rpcError.code)) {
            return new AcpAuthError(rpcError.message || 'Unknown auth error');
        }
        return new Error(`ACP RPC error (${rpcError.code}): ${rpcError.message}`);
    }

    /**
     * Reject all pending requests with the given error.
     */
    _rejectAll(err) {
        for (const [id, pending] of this._pendingRequests) {
            pending.reject(err);
        }
        this._pendingRequests.clear();
        // Also reject any active notification waiters
        for (const handler of this._notificationHandlers) {
            if (handler._reject) handler._reject(err);
        }
        this._notificationHandlers = [];
    }

    /**
     * Send a JSON-RPC request and return a promise for the response.
     */
    _sendRequest(method, params) {
        return new Promise((resolve, reject) => {
            const id = this._nextId++;
            const request = {
                jsonrpc: '2.0',
                id,
                method,
                params,
            };

            this._pendingRequests.set(id, { resolve, reject });
            this._process.stdin.write(JSON.stringify(request) + '\n');
        });
    }

    /**
     * Perform the ACP initialize handshake.
     */
    async _initialize() {
        const result = await this._withTimeout(
            this._sendRequest('initialize', {
                protocolVersion: 1,
                clientCapabilities: {},
                clientInfo: { name: 'fhir-ai-pipeline', version: '1.0.0' },
            })
        );
        return result;
    }

    /**
     * Create a new ACP session.
     */
    async _createSession() {
        const result = await this._withTimeout(
            this._sendRequest('session/new', {
                cwd: process.cwd(),
                mcpServers: [],
            })
        );
        this._sessionId = result.sessionId;
        return result;
    }

    /**
     * Send a prompt and wait for AgentMessageChunk notifications until TurnEnd.
     */
    async _sendPrompt(prompt) {
        const chunks = [];

        // Set up notification listener before sending prompt
        const turnComplete = new Promise((resolve, reject) => {
            const handler = (params) => {
                if (params.type === 'AgentMessageChunk' && params.data && params.data.text) {
                    chunks.push(params.data.text);
                } else if (params.type === 'TurnEnd') {
                    // Remove this handler
                    const idx = this._notificationHandlers.indexOf(handler);
                    if (idx !== -1) this._notificationHandlers.splice(idx, 1);
                    resolve();
                }
            };
            handler._reject = reject;
            this._notificationHandlers.push(handler);
        });

        // Send the prompt request
        await this._withTimeout(
            this._sendRequest('session/prompt', {
                sessionId: this._sessionId,
                content: [{ type: 'text', text: prompt }],
            })
        );

        // Wait for TurnEnd
        await this._withTimeout(turnComplete);

        return chunks.join('');
    }

    /**
     * Wrap a promise with a timeout.
     */
    _withTimeout(promise) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this._activeTimers.delete(timer);
                reject(new AcpTimeoutError(this._timeout));
            }, this._timeout);
            this._activeTimers.add(timer);

            promise.then(
                (result) => {
                    clearTimeout(timer);
                    this._activeTimers.delete(timer);
                    resolve(result);
                },
                (err) => {
                    clearTimeout(timer);
                    this._activeTimers.delete(timer);
                    reject(err);
                }
            );
        });
    }
}

module.exports = { AcpAdapter, AcpTimeoutError, AcpAuthError };
