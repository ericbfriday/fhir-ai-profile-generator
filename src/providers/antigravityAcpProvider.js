/**
 * Antigravity ACP Provider — connects to Antigravity (agy) via ACP subprocess.
 */
const LlmProvider = require('./llmProvider');
const { AcpAdapter } = require('./acpAdapter');
const { binaryExists } = require('./binaryLookup');

class AntigravityAcpProvider extends LlmProvider {

    static id = 'antigravity-acp';

    /** @internal — injectable for testing */
    static _deps = { binaryExists, AcpAdapter };

    static isAvailable() {
        return AntigravityAcpProvider._deps.binaryExists('agy');
    }

    constructor() {
        super();
        const { AcpAdapter: Adapter } = AntigravityAcpProvider._deps;
        this.adapter = new Adapter('agy', ['--acp'], { model: 'antigravity' });
    }

    async complete(prompt, options = {}) {
        return this.adapter.complete(prompt, options);
    }

    dispose() {
        this.adapter.dispose();
    }
}

module.exports = AntigravityAcpProvider;
