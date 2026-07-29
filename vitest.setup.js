/**
 * Vitest global setup — prevents ACP providers from detecting real binaries
 * during tests, which would cause test timeouts from spawned processes.
 */
const KiroAcpProvider = require('./src/providers/kiroAcpProvider');
const ClaudeAcpProvider = require('./src/providers/claudeAcpProvider');
const CodexAcpProvider = require('./src/providers/codexAcpProvider');
const AntigravityAcpProvider = require('./src/providers/antigravityAcpProvider');
const OpenCodeAcpProvider = require('./src/providers/openCodeAcpProvider');

const noopBinaryExists = () => false;

// Patch all ACP providers to never find binaries during tests
for (const Provider of [KiroAcpProvider, ClaudeAcpProvider, CodexAcpProvider, AntigravityAcpProvider, OpenCodeAcpProvider]) {
    Provider._deps = { ...Provider._deps, binaryExists: noopBinaryExists };
}
