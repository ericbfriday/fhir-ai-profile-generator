/**
 * Provider Registry — factory that selects the appropriate LLM Provider
 * based on availability.
 *
 * Currently knows about:
 *   - ACP Provider (via Kiro CLI)
 *
 * If no provider is available, throws a clear error explaining why.
 */
const AcpProvider = require('./acpProvider');

/**
 * Registered providers in priority order.
 * The first available provider wins.
 */
const providers = [
    { name: 'ACP (Kiro CLI)', Provider: AcpProvider },
];

/**
 * Create and return the first available LLM Provider.
 *
 * @returns {import('./llmProvider')} An instance of the selected provider.
 * @throws {Error} If no provider is currently available.
 */
function getProvider() {
    for (const { name, Provider } of providers) {
        if (Provider.isAvailable()) {
            return new Provider();
        }
    }

    const registered = providers.map(p => p.name).join(', ');
    throw new Error(
        `No LLM Provider is currently available.\n` +
        `Registered providers: ${registered}\n` +
        `The ACP Provider requires a live Kiro CLI ACP connection.\n` +
        `Ensure Kiro CLI is running and ACP integration is enabled.`
    );
}

module.exports = { getProvider, providers };
