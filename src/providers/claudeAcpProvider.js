/**
 * Claude ACP Provider — connects to Claude via ACP subprocess.
 */
const LlmProvider = require('./llmProvider');
const { AcpAdapter } = require('./acpAdapter');
const { binaryExists } = require('./binaryLookup');

class ClaudeAcpProvider extends LlmProvider {

    static id = 'claude-acp';

    /** @internal — injectable for testing */
    static _deps = { binaryExists, AcpAdapter };

    static isAvailable() {
        return ClaudeAcpProvider._deps.binaryExists('claude-agent-acp');
    }

    constructor() {
        super();
        const { AcpAdapter: Adapter } = ClaudeAcpProvider._deps;
        this.adapter = new Adapter('claude-agent-acp', [], { model: 'claude' });
    }

    async complete(prompt, options = {}) {
        return this.adapter.complete(prompt, options);
    }

    dispose() {
        this.adapter.dispose();
    }
}

module.exports = ClaudeAcpProvider;
