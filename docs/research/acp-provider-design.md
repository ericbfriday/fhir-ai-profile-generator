# LLM Provider Design — Implementation Specification

> Research document for wiring real LLM providers into the FHIR AI Profile Generator.
> Produced: 2026-07-28

---

## 1. Provider Architecture

### Current State

The project already has the right structural pattern:

- **Base class**: `src/providers/llmProvider.js` — defines `complete(prompt, options)` and `static isAvailable()`
- **Registry**: `src/providers/index.js` — iterates providers in priority order, returns first available
- **Stub**: `src/providers/acpProvider.js` — placeholder that always returns `isAvailable() = false`

The architecture is sound. This design extends it without changing the interface.

### Provider Registry — Extended

```js
// src/providers/index.js
const AnthropicProvider = require('./anthropicProvider');
const OpenAiProvider = require('./openaiProvider');
const AcpProvider = require('./acpProvider');

/**
 * Providers in priority order. First available wins.
 * Order rationale:
 *   1. Anthropic — primary target, best FSH reasoning in testing
 *   2. OpenAI — widely available fallback
 *   3. ACP — future Kiro CLI integration
 */
const providers = [
    { name: 'Anthropic (Claude)', Provider: AnthropicProvider },
    { name: 'OpenAI (GPT)', Provider: OpenAiProvider },
    { name: 'ACP (Kiro CLI)', Provider: AcpProvider },
];

function getProvider() {
    for (const { name, Provider } of providers) {
        if (Provider.isAvailable()) {
            return new Provider();
        }
    }

    const registered = providers.map(p => p.name).join(', ');
    throw new Error(
        `No LLM Provider is currently available.\n` +
        `Registered providers: ${registered}\n\n` +
        `To enable a provider, set one of:\n` +
        `  ANTHROPIC_API_KEY=sk-ant-...\n` +
        `  OPENAI_API_KEY=sk-...\n`
    );
}

module.exports = { getProvider, providers };
```

### Availability Detection

Each provider uses a **static, synchronous** `isAvailable()` check. This keeps the registry fast and predictable:

| Provider | isAvailable() check |
|----------|-------------------|
| Anthropic | `!!process.env.ANTHROPIC_API_KEY` |
| OpenAI | `!!process.env.OPENAI_API_KEY` |
| ACP | Check for live ACP connection (future) |

No network calls during availability detection. The key's validity is only confirmed when `complete()` is first called.

### Provider-Specific Options vs Shared Interface

The shared interface stays unchanged:

```js
async complete(prompt, options = {}) → { content, model, usage }
```

Where `options` is:
- `maxTokens` — max response tokens (provider maps to its API field name)
- `temperature` — sampling temperature 0–1
- `systemPrompt` — system-level instructions

Each provider maps these to its API's parameter names internally. Callers never see provider-specific details.

---

## 2. Anthropic Claude Provider

### File: `src/providers/anthropicProvider.js`

```js
const LlmProvider = require('./llmProvider');

class AnthropicProvider extends LlmProvider {

    constructor() {
        super();
        // Lazy-require to avoid import errors when SDK not installed
        const Anthropic = require('@anthropic-ai/sdk');
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
            maxRetries: 2,      // SDK default, explicit for clarity
            timeout: 120_000,   // 2 minutes for non-streaming
        });
        this.defaultModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
        this.defaultMaxTokens = parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10);
    }

    static isAvailable() {
        return !!process.env.ANTHROPIC_API_KEY;
    }

    async complete(prompt, options = {}) {
        const model = options.model || this.defaultModel;
        const maxTokens = options.maxTokens || this.defaultMaxTokens;

        const params = {
            model,
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
        };

        // System prompt is a top-level parameter in Anthropic's API
        if (options.systemPrompt) {
            params.system = options.systemPrompt;
        }

        // Temperature — only set if provided (some models don't support it)
        if (options.temperature !== undefined) {
            params.temperature = options.temperature;
        }

        const message = await this.client.messages.create(params);

        // Extract text from content blocks
        const content = message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');

        return {
            content,
            model: message.model,
            usage: {
                promptTokens: message.usage.input_tokens,
                completionTokens: message.usage.output_tokens,
            },
        };
    }
}

module.exports = AnthropicProvider;
```

### Key Design Decisions

1. **Lazy `require('@anthropic-ai/sdk')`** in the constructor — if the package isn't installed, only this provider breaks, not the whole registry.

2. **System prompt** is a top-level `system` field in Anthropic's Messages API, not a message role. The provider maps from our interface's `options.systemPrompt` to `params.system`.

3. **Content blocks** — Anthropic returns an array of content blocks. We filter for `type: 'text'` and concatenate. This handles multi-block responses gracefully.

4. **Token usage** maps `input_tokens` → `promptTokens` and `output_tokens` → `completionTokens`.

5. **Temperature caveat** — Claude Opus 4.7+ does not support temperature. The provider should only set it when provided and let the SDK throw if the model rejects it. For our use case (Sonnet), temperature is supported.

### NPM Package

```
npm install @anthropic-ai/sdk
```

Add as a regular dependency (not devDependency) since it's needed at runtime.

---

## 3. OpenAI Provider

### File: `src/providers/openaiProvider.js`

```js
const LlmProvider = require('./llmProvider');

class OpenAiProvider extends LlmProvider {

    constructor() {
        super();
        const OpenAI = require('openai');
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            maxRetries: 2,
            timeout: 120_000,
        });
        this.defaultModel = process.env.OPENAI_MODEL || 'gpt-4o';
        this.defaultMaxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '4096', 10);
    }

    static isAvailable() {
        return !!process.env.OPENAI_API_KEY;
    }

    async complete(prompt, options = {}) {
        const model = options.model || this.defaultModel;
        const maxTokens = options.maxTokens || this.defaultMaxTokens;

        const messages = [];

        // OpenAI uses a "developer" role (or "system" for older models)
        if (options.systemPrompt) {
            messages.push({ role: 'developer', content: options.systemPrompt });
        }

        messages.push({ role: 'user', content: prompt });

        const params = {
            model,
            max_completion_tokens: maxTokens,
            messages,
        };

        if (options.temperature !== undefined) {
            params.temperature = options.temperature;
        }

        const completion = await this.client.chat.completions.create(params);

        const choice = completion.choices[0];
        return {
            content: choice.message.content || '',
            model: completion.model,
            usage: {
                promptTokens: completion.usage?.prompt_tokens || 0,
                completionTokens: completion.usage?.completion_tokens || 0,
            },
        };
    }
}

module.exports = OpenAiProvider;
```

### Key Design Decisions

1. **System prompt** is a message with `role: 'developer'` (OpenAI's newer convention) in the messages array.

2. **`max_completion_tokens`** is the modern parameter name (replaces deprecated `max_tokens` for newer models).

3. **Usage** may be null in streaming scenarios, so we default to 0.

### NPM Package

```
npm install openai
```

---

## 4. Configuration Design

### Environment Variables (Primary Mechanism)

Environment variables are the right choice for this project:
- Simple, no config file parsing needed
- Works with `.env` files via `dotenv` (optional)
- Secrets stay out of source control
- CI/CD friendly

### Complete Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | For Anthropic | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Model to use |
| `ANTHROPIC_MAX_TOKENS` | No | `4096` | Default max response tokens |
| `OPENAI_API_KEY` | For OpenAI | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o` | Model to use |
| `OPENAI_MAX_TOKENS` | No | `4096` | Default max response tokens |
| `LLM_PROVIDER` | No | (auto) | Force a specific provider: `anthropic`, `openai`, `acp` |

### Provider Priority Override

An optional `LLM_PROVIDER` env var can force a specific provider instead of auto-detection:

```js
function getProvider() {
    const forced = process.env.LLM_PROVIDER;
    if (forced) {
        const entry = providers.find(p => p.Provider.id === forced);
        if (!entry) throw new Error(`Unknown provider: ${forced}`);
        if (!entry.Provider.isAvailable()) {
            throw new Error(`Provider "${forced}" is not available (missing credentials?)`);
        }
        return new entry.Provider();
    }

    // Default: first available
    for (const { name, Provider } of providers) { /* ... */ }
}
```

Each provider class gets a static `id` field:
```js
class AnthropicProvider extends LlmProvider {
    static id = 'anthropic';
    // ...
}
```

### Proposed `.env.example`

```bash
# LLM Provider Configuration
# Set at least one API key to enable AI-powered profile generation.
# The first available provider in priority order will be used.

# --- Anthropic (Primary) ---
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
# ANTHROPIC_MODEL=claude-sonnet-4-20250514
# ANTHROPIC_MAX_TOKENS=4096

# --- OpenAI (Secondary) ---
# OPENAI_API_KEY=sk-your-key-here
# OPENAI_MODEL=gpt-4o
# OPENAI_MAX_TOKENS=4096

# --- Override: force a specific provider ---
# LLM_PROVIDER=anthropic
```

### Optional: dotenv Support

Add `dotenv` as an optional dependency. Load it at entry point only:

```js
// src/index.js (top of file)
try { require('dotenv').config(); } catch (e) { /* dotenv not installed, skip */ }
```

This is optional — the system works without dotenv if env vars are set externally.

---

## 5. Error Handling

### SDK Built-in Retries

Both `@anthropic-ai/sdk` and `openai` have built-in retry logic:

| SDK | Default Retries | Retried Errors |
|-----|----------------|----------------|
| Anthropic | 2 | Connection errors, 408, 409, 429, ≥500 |
| OpenAI | 2 | Connection errors, 408, 409, 429, ≥500 |

**Recommendation**: Use SDK defaults. Do NOT add custom retry logic on top — it would compound delays.

### Timeout Handling

Set explicit timeouts on each provider's client (120 seconds). The SDKs throw timeout errors that bubble up naturally.

### Error Classification in Providers

```js
// Wrap the SDK call to normalize errors for consumers
async complete(prompt, options = {}) {
    try {
        // ... SDK call ...
    } catch (err) {
        // Let rate limit and transient errors bubble (SDK already retried)
        // Wrap with context for debugging
        const wrapped = new Error(
            `[AnthropicProvider] Completion failed: ${err.message}`
        );
        wrapped.cause = err;
        wrapped.isRetryable = err.status === 429 || err.status >= 500;
        throw wrapped;
    }
}
```

### Graceful Degradation Strategy

The system has three levels of degradation:

1. **Provider fails → try next provider** (NOT implemented in v1)
   - Reason: if the user has one key set, failing over to nothing is confusing.
   - Future: Add `getProviderWithFallback()` that tries all available providers in order.

2. **All providers fail → agent fallback logic**
   - The ArchitectAgent already has `_createDesignViaFallback()` — this stays.
   - The FshAuthorAgent uses rule-based generation — this stays.
   - Only the RepairAgent has no fallback (by design — repair requires reasoning).

3. **Throw to orchestrator → skip repair loop**
   - The Orchestrator's `_repairLoop` already catches provider errors and returns the initial result.
   - This is correct behavior: return what we have, don't crash.

### When to Fall Back vs When to Throw

| Scenario | Behavior |
|----------|----------|
| No API key set (all providers) | `getProvider()` throws → agents use fallback if they have one |
| API key invalid (401) | Provider throws → agent catches → uses fallback or throws |
| Rate limited after retries (429) | Provider throws → same as above |
| Network timeout | Provider throws → same as above |
| RepairAgent with no provider | Throws (no fallback possible) |
| Orchestrator catches RepairAgent error | Returns initial compilation result (graceful) |

### Decision: No Cross-Provider Fallback in v1

If the selected provider's API call fails, we do NOT automatically try the next provider. Reasons:
- Keeps behavior predictable (user knows which provider is active)
- Avoids surprise billing on a secondary provider
- The agent-level fallback (hardcoded logic) already provides degradation

Future enhancement: Add a `PROVIDER_FALLBACK=true` env var to enable cross-provider retry.

---

## 6. Testing Strategy

### Unit Tests: Mock the Provider

The existing test suite already mocks providers correctly. The pattern:

```js
// test/agents/architectAgent.test.js pattern
import { vi } from 'vitest';

// Mock the entire providers module
vi.mock('../src/providers', () => ({
    getProvider: vi.fn(),
}));

// In each test, configure the mock
import { getProvider } from '../src/providers';

it('uses LLM when provider available', async () => {
    const mockProvider = {
        complete: vi.fn().mockResolvedValue({
            content: JSON.stringify({
                resourceType: 'Patient',
                profileName: 'GeneratedPatient',
                fieldsFound: ['name'],
                constraints: [{ path: 'Patient.name', min: 1, max: '*' }],
            }),
            model: 'claude-sonnet-4-20250514',
            usage: { promptTokens: 100, completionTokens: 50 },
        }),
    };
    getProvider.mockReturnValue(mockProvider);

    const agent = new ArchitectAgent();
    const result = await agent.createProfileDesign(patientJson);

    expect(mockProvider.complete).toHaveBeenCalledOnce();
    expect(result.profileName).toBe('GeneratedPatient');
});
```

### Provider Unit Tests (No API Calls)

Test the provider classes themselves with a mocked SDK client:

```js
// test/providers/anthropicProvider.test.js
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the SDK
vi.mock('@anthropic-ai/sdk', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            messages: {
                create: vi.fn().mockResolvedValue({
                    content: [{ type: 'text', text: 'Hello' }],
                    model: 'claude-sonnet-4-20250514',
                    usage: { input_tokens: 10, output_tokens: 5 },
                }),
            },
        })),
    };
});

describe('AnthropicProvider', () => {
    beforeEach(() => {
        process.env.ANTHROPIC_API_KEY = 'test-key';
    });

    it('maps options to Anthropic API parameters', async () => {
        const AnthropicProvider = require('../src/providers/anthropicProvider');
        const provider = new AnthropicProvider();

        const result = await provider.complete('test prompt', {
            systemPrompt: 'You are a helper',
            temperature: 0.5,
            maxTokens: 2048,
        });

        expect(result.content).toBe('Hello');
        expect(result.usage.promptTokens).toBe(10);
        expect(result.usage.completionTokens).toBe(5);
    });

    it('isAvailable returns false without API key', () => {
        delete process.env.ANTHROPIC_API_KEY;
        const AnthropicProvider = require('../src/providers/anthropicProvider');
        expect(AnthropicProvider.isAvailable()).toBe(false);
    });
});
```

### Integration Tests (Env-Gated)

For real API calls, gate behind an env var:

```js
// test/providers/anthropicProvider.integration.test.js
import { describe, it, expect } from 'vitest';

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!RUN_INTEGRATION)('AnthropicProvider (integration)', () => {
    it('completes a simple prompt against real API', async () => {
        const AnthropicProvider = require('../src/providers/anthropicProvider');
        const provider = new AnthropicProvider();

        const result = await provider.complete('Say "hello" and nothing else.', {
            maxTokens: 10,
            temperature: 0,
        });

        expect(result.content.toLowerCase()).toContain('hello');
        expect(result.usage.promptTokens).toBeGreaterThan(0);
        expect(result.model).toContain('claude');
    });
});
```

Run with: `RUN_INTEGRATION_TESTS=true npm test`

### Test Configuration

Add to `vitest.config.js`:
```js
export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        // Exclude integration tests from normal runs
        exclude: ['**/*.integration.test.js'],
    },
});
```

And a separate script:
```json
{
    "scripts": {
        "test": "vitest run",
        "test:watch": "vitest",
        "test:integration": "RUN_INTEGRATION_TESTS=true vitest run --include '**/*.integration.test.js'"
    }
}
```

---

## 7. Implementation Checklist

The implementation agent should follow this order:

### Step 1: Install Dependencies
```bash
npm install @anthropic-ai/sdk openai
```

### Step 2: Create Anthropic Provider
- File: `src/providers/anthropicProvider.js`
- Follow the code sketch in Section 2 exactly
- Add `static id = 'anthropic'`

### Step 3: Create OpenAI Provider
- File: `src/providers/openaiProvider.js`
- Follow the code sketch in Section 3 exactly
- Add `static id = 'openai'`

### Step 4: Update Provider Registry
- File: `src/providers/index.js`
- Add both new providers to the `providers` array (before ACP)
- Add `LLM_PROVIDER` override logic
- Update error message to show env var instructions

### Step 5: Add `.env.example`
- File: `.env.example` at project root
- Follow Section 4 template

### Step 6: Optional dotenv
```bash
npm install dotenv
```
- Add try/catch require at top of `src/index.js`

### Step 7: Write Tests
- `test/providers/anthropicProvider.test.js` — mock SDK, test mapping
- `test/providers/openaiProvider.test.js` — mock SDK, test mapping
- Update `test/providers/index.test.js` — add cases for new providers
- `test/providers/anthropicProvider.integration.test.js` — env-gated

### Step 8: Verify Existing Tests Still Pass
```bash
npm test
```

All 57 existing tests must continue to pass. The provider mocks in agent tests should work unchanged since the interface (`complete()` signature and return shape) is identical.

---

## 8. File Layout After Implementation

```
src/providers/
├── index.js              # Registry (updated)
├── llmProvider.js        # Base class (unchanged)
├── acpProvider.js        # ACP stub (unchanged)
├── anthropicProvider.js  # NEW
└── openaiProvider.js     # NEW

test/providers/
├── index.test.js                         # Updated
├── anthropicProvider.test.js             # NEW
├── openaiProvider.test.js                # NEW
└── anthropicProvider.integration.test.js # NEW (env-gated)

.env.example  # NEW
```

---

## 9. Future Considerations

### Adding a New Provider

To add a provider (e.g., Ollama for local models):

1. Create `src/providers/ollamaProvider.js` extending `LlmProvider`
2. Implement `static isAvailable()` (check if Ollama is running on localhost:11434)
3. Implement `complete()` mapping to Ollama's OpenAI-compatible API
4. Add to the `providers` array in `src/providers/index.js`
5. Done — no other code changes needed

### Streaming (Not Required for v1)

The current interface returns a complete response. If streaming is needed later:
- Add `stream(prompt, options)` to `LlmProvider` returning an async iterable
- Both SDKs support streaming natively
- Agents would need to be updated to consume streams

### Cost Tracking

The `usage` field in every response enables cost tracking:
- Log usage after each call
- Accumulate across an orchestrator run
- Report total tokens consumed

This is already supported by the interface — just needs a consumer.
