/**
 * Kiro ACP Provider — connects to an LLM via ACP through Kiro CLI.
 */
const LlmProvider = require('./llmProvider');
const { AcpAdapter } = require('./acpAdapter');
const { binaryExists } = require('./binaryLookup');

class KiroAcpProvider extends LlmProvider {

    static id = 'kiro-acp';

    /** @internal — injectable for testing */
    static _deps = { binaryExists, AcpAdapter };

    static isAvailable() {
        return KiroAcpProvider._deps.binaryExists('kiro-cli');
    }

    constructor() {
        super();
        const { AcpAdapter: Adapter } = KiroAcpProvider._deps;
        this.adapter = new Adapter('kiro-cli', ['acp'], { model: 'kiro' });
    }

    async complete(prompt, options = {}) {
        return this.adapter.complete(prompt, options);
    }

    dispose() {
        this.adapter.dispose();
    }
}

module.exports = KiroAcpProvider;
