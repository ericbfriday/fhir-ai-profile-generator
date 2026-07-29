/**
 * Codex ACP Provider — connects to Codex via ACP subprocess.
 * Starts in read-only agent mode by default.
 */
const LlmProvider = require('./llmProvider');
const { AcpAdapter } = require('./acpAdapter');
const { binaryExists } = require('./binaryLookup');

class CodexAcpProvider extends LlmProvider {

    static id = 'codex-acp';

    /** @internal — injectable for testing */
    static _deps = { binaryExists, AcpAdapter };

    static isAvailable() {
        return CodexAcpProvider._deps.binaryExists('codex-acp');
    }

    constructor() {
        super();
        const { AcpAdapter: Adapter } = CodexAcpProvider._deps;
        this.adapter = new Adapter('codex-acp', [], {
            model: 'codex',
            env: { INITIAL_AGENT_MODE: 'read-only' },
        });
    }

    async complete(prompt, options = {}) {
        return this.adapter.complete(prompt, options);
    }

    dispose() {
        this.adapter.dispose();
    }
}

module.exports = CodexAcpProvider;
