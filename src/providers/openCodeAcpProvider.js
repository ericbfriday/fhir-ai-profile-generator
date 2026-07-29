/**
 * OpenCode ACP Provider — connects to OpenCode via ACP subprocess.
 */
const LlmProvider = require('./llmProvider');
const { AcpAdapter } = require('./acpAdapter');
const { binaryExists } = require('./binaryLookup');

class OpenCodeAcpProvider extends LlmProvider {

    static id = 'opencode-acp';

    /** @internal — injectable for testing */
    static _deps = { binaryExists, AcpAdapter };

    static isAvailable() {
        return OpenCodeAcpProvider._deps.binaryExists('opencode');
    }

    constructor() {
        super();
        const { AcpAdapter: Adapter } = OpenCodeAcpProvider._deps;
        this.adapter = new Adapter('opencode', ['acp'], { model: 'opencode' });
    }

    async complete(prompt, options = {}) {
        return this.adapter.complete(prompt, options);
    }

    dispose() {
        this.adapter.dispose();
    }
}

module.exports = OpenCodeAcpProvider;
