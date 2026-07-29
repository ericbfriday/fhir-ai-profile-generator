/**
 * Provider Registry — factory that selects the appropriate LLM Provider
 * based on availability.
 *
 * Priority order:
 *   1. KiroAcpProvider — Kiro CLI ACP integration
 *   2. ClaudeAcpProvider — Claude Agent ACP
 *   3. CodexAcpProvider — Codex ACP
 *   4. AntigravityAcpProvider — Antigravity ACP
 *   5. OpenCodeAcpProvider — OpenCode ACP
 *   6. Anthropic (Claude) — direct API, best FSH reasoning
 *   7. OpenAI (GPT) — widely available direct API
 *   8. OpenRouter — unified fallback (any model via single key)
 *
 * If no provider is available, throws a clear error explaining why.
 */
const KiroAcpProvider = require('./kiroAcpProvider');
const ClaudeAcpProvider = require('./claudeAcpProvider');
const CodexAcpProvider = require('./codexAcpProvider');
const AntigravityAcpProvider = require('./antigravityAcpProvider');
const OpenCodeAcpProvider = require('./openCodeAcpProvider');
const AnthropicProvider = require('./anthropicProvider');
const OpenAiProvider = require('./openaiProvider');
const OpenRouterProvider = require('./openRouterProvider');

/**
 * Registered providers in priority order.
 * The first available provider wins.
 */
const providers = [
    { name: 'ACP (Kiro CLI)', Provider: KiroAcpProvider },
    { name: 'ACP (Claude Agent)', Provider: ClaudeAcpProvider },
    { name: 'ACP (Codex)', Provider: CodexAcpProvider },
    { name: 'ACP (Antigravity)', Provider: AntigravityAcpProvider },
    { name: 'ACP (OpenCode)', Provider: OpenCodeAcpProvider },
    { name: 'Anthropic (Claude)', Provider: AnthropicProvider },
    { name: 'OpenAI (GPT)', Provider: OpenAiProvider },
    { name: 'OpenRouter', Provider: OpenRouterProvider },
];

/**
 * Create and return the first available LLM Provider.
 *
 * If LLM_PROVIDER env var is set, forces that specific provider.
 * Otherwise, returns the first available provider in priority order.
 *
 * @returns {import('./llmProvider')} An instance of the selected provider.
 * @throws {Error} If no provider is currently available.
 */
function getProvider() {
    // Allow forcing a specific provider via env var
    const forced = process.env.LLM_PROVIDER;
    if (forced) {
        const entry = providers.find(p => p.Provider.id === forced);
        if (!entry) {
            const validIds = providers.map(p => p.Provider.id).filter(Boolean).join(', ');
            throw new Error(
                `Unknown LLM_PROVIDER: "${forced}". Valid options: ${validIds}`
            );
        }
        if (!entry.Provider.isAvailable()) {
            throw new Error(
                `Provider "${forced}" is not available (missing credentials?)`
            );
        }
        console.log(`[Provider] Using: ${entry.name}`);
        return new entry.Provider();
    }

    // Default: first available wins
    for (const { name, Provider } of providers) {
        if (Provider.isAvailable()) {
            console.log(`[Provider] Using: ${name}`);
            return new Provider();
        }
    }

    const registered = providers.map(p => p.name).join(', ');
    throw new Error(
        `No LLM Provider is currently available.\n` +
        `Registered providers: ${registered}\n\n` +
        `To enable a provider, either:\n` +
        `  • Run inside an ACP agent (Kiro, Claude, Codex, Antigravity, OpenCode)\n` +
        `  • Set ANTHROPIC_API_KEY=sk-ant-...\n` +
        `  • Set OPENAI_API_KEY=sk-...\n` +
        `  • Set OPENROUTER_API_KEY=sk-or-v1-...\n`
    );
}

module.exports = { getProvider, providers };
