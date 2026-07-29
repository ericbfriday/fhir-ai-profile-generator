# ACP Subscription-First Provider Strategy

> Research document for routing LLM completions through subscription-billed ACP agents
> before falling back to API-key-based direct providers.
> Produced: 2026-07-29

---

## 1. Goal

Use **subscription billing** (OAuth/login-gated) as the primary payment path for model
completions in the FHIR AI Profile Generator pipeline. Fall back to per-provider API
keys, then to OpenRouter as a unified last resort.

Priority order:

```
┌─────────────────────────────────────────────────────────┐
│ Tier 1: Subscription-billed ACP agents (no API keys)    │
│   1. Kiro CLI ACP (AWS/Kiro subscription)               │
│   2. Claude Agent ACP (Anthropic Pro/Max subscription)   │
│   3. Codex ACP (ChatGPT/OpenAI subscription)            │
│   4. Antigravity CLI (Google AI Pro/Ultra subscription)  │
│   5. OpenCode ACP (Z.AI Coding Plan subscription)       │
├─────────────────────────────────────────────────────────┤
│ Tier 2: Direct API key providers                        │
│   6. Anthropic API (ANTHROPIC_API_KEY)                  │
│   7. OpenAI API (OPENAI_API_KEY)                        │
├─────────────────────────────────────────────────────────┤
│ Tier 3: Unified fallback                                │
│   8. OpenRouter (OPENROUTER_API_KEY)                    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Protocol Clarification: Which "ACP" Are We Talking About?

There are two protocols that have carried the "ACP" name:

| Protocol | Full Name | Status (July 2026) |
|----------|-----------|-------------------|
| Agent Communication Protocol | IBM/BeeAI (March 2025) | **Merged into A2A** under Linux Foundation (Aug 2025). Dead as standalone. |
| Agent Client Protocol | Zed/JetBrains (2025–present) | **Active.** Registry at agentclientprotocol.com. Co-launched with JetBrains Jan 2026. 3.4k+ stars. |

**This document is entirely about the Agent Client Protocol** — the stdio JSON-RPC 2.0
standard for editor↔agent communication. All providers below implement this protocol.

The project's `CONTEXT.md` glossary entry for ACP should be updated to reference the
Agent Client Protocol specifically.

---

## 3. Provider Profiles

### 3.1 Kiro CLI ACP

| | |
|---|---|
| **Command** | `kiro-cli acp` |
| **Package** | Built into Kiro CLI |
| **Auth** | AWS/Kiro subscription (already authenticated if you're running Kiro) |
| **Billing** | Kiro subscription (AWS-backed) — no separate API key |
| **ACP version** | Full implementation: `initialize`, `session/new`, `session/prompt`, `session/cancel`, `session/set_mode`, `session/set_model` |
| **Models** | Auto-selected on server side (currently Claude Sonnet 4, may change) |
| **Stars/maturity** | Production — it's what powers `kiro-cli chat` |

**How it works as a provider:**

Kiro CLI can be spawned as a subprocess in ACP mode. The parent process sends
`session/new` + `session/prompt` over stdio JSON-RPC, receives streamed
`AgentMessageChunk` notifications, and collects the final response at `TurnEnd`.
Billing routes through the already-authenticated Kiro subscription.

**Circular dependency note:** If the FHIR pipeline is already running *inside* Kiro CLI,
spawning another `kiro-cli acp` creates a child agent session. This is architecturally
fine — it's just a subprocess — but it means two concurrent sessions against the same
subscription. The pipeline agent orchestrates; the child provides completions.

**Availability check:** `which kiro-cli` succeeds and the user has an active Kiro session.

---

### 3.2 Claude Agent ACP (Anthropic)

| | |
|---|---|
| **Command** | `claude-agent-acp` (or `npx @agentclientprotocol/claude-agent-acp`) |
| **Package** | `@agentclientprotocol/claude-agent-acp` (npm) |
| **Auth** | Claude subscription OAuth (browser login, token cached) |
| **Billing** | Pro $20/mo, Max 5× $100/mo, Max 20× $200/mo — draws from subscription limits |
| **ACP version** | Full Agent Client Protocol with Claude Agent SDK |
| **Models** | Claude Sonnet 4, Claude Opus 4 (subscription tier dependent) |
| **Stars** | 2.3k ★, 613 commits, official `agentclientprotocol` org |

**How it works:**

The package wraps the Claude Agent SDK and exposes it via ACP. Authentication uses the
same OAuth flow as Claude Code — browser-based login, token cached locally. No
`ANTHROPIC_API_KEY` needed. Usage bills against the subscription's usage limits.

**Key billing fact (June 2026):** Anthropic paused the planned separation of Agent SDK
billing on June 15, 2026. Currently, ALL usage (interactive + `claude -p` + Agent SDK)
draws from the same subscription pool. No separate credit to claim. This means:
- If you have a Max 20× subscription ($200/mo), both your interactive Claude Code and
  this ACP provider share the same pool.
- There is no way to isolate pipeline usage from interactive usage on the same account.
- API key billing remains separate — if `ANTHROPIC_API_KEY` is set, it routes through
  API billing, NOT subscription.

**Availability check:** `claude-agent-acp --version` succeeds, or the binary exists at a
known path. The OAuth token must be cached (user has logged in at least once).

---

### 3.3 Codex ACP (OpenAI)

| | |
|---|---|
| **Command** | `codex-acp` (or `npx @agentclientprotocol/codex-acp`) |
| **Package** | `@agentclientprotocol/codex-acp` (npm) |
| **Auth** | ChatGPT login (browser OAuth), API key, or custom gateway |
| **Billing** | ChatGPT Plus/Pro subscription OR `CODEX_API_KEY`/`OPENAI_API_KEY` |
| **ACP version** | Full Agent Client Protocol |
| **Models** | OpenAI models via Codex runtime (reasoning, fast mode configurable) |
| **Stars** | 199 ★, 436 commits, official `agentclientprotocol` org |

**How it works:**

Codex ACP bridges the OpenAI Codex CLI to the Agent Client Protocol. It starts a Codex
App Server, translates ACP requests into Codex operations, and maps events back.

**Auth methods (advertised during ACP initialize):**
1. **ChatGPT login** — browser OAuth, bills against ChatGPT subscription. Set
   `NO_BROWSER=1` to hide in headless environments.
2. **API key** — `CODEX_API_KEY` or `OPENAI_API_KEY`, bills against API account.
3. **Custom gateway** — client opts in to gateway auth capability.

For subscription billing, use the ChatGPT login method. The user must have an active
ChatGPT Plus or Pro subscription with Codex access.

**Caveat:** Codex is an agent-level provider. It owns the tool loop — it can execute
shell commands, write files, and call MCP tools. For pure completion use, you prompt it
and it responds, but it may also take autonomous actions unless configured with
`INITIAL_AGENT_MODE=read-only`.

**Availability check:** `codex-acp --version` or `npx @agentclientprotocol/codex-acp --version`.
ChatGPT OAuth token must be cached.

---

### 3.4 Antigravity CLI (Google)

| | |
|---|---|
| **Command** | `agy` (with `--acp` flag, inherited from Gemini CLI) |
| **Package** | Closed-source binary, installed via `curl -fsSL https://antigravity.google/cli/install.sh \| bash` |
| **Auth** | Google OAuth (browser login, token cached in system keyring) |
| **Billing** | Google AI Pro / Google AI Ultra / Google One AI Premium subscription |
| **ACP version** | Agent Client Protocol (inherited from Gemini CLI's `--acp` flag) |
| **Models** | gemini-3.1-pro, claude-opus-4-6-thinking (via cloudcode-pa.googleapis.com) |
| **Status** | Replaced Gemini CLI on June 18, 2026. Closed-source, Go binary. |

**How it works:**

Antigravity CLI authenticates via Google account OAuth. Token is cached in the system
keyring. Bills against the user's Google AI subscription tier. Provides access to both
Google and non-Google models through Google's infrastructure.

**ACP mode:** `agy --acp` starts the agent in ACP mode (stdio JSON-RPC). Same protocol
as Gemini CLI's `gemini --acp`.

**Key facts:**
- Auth is purely OAuth — no API key needed or accepted for consumer tiers.
- Token caching has had bugs (macOS keyring not loading on fresh process — issue #24).
- Enterprise users can connect a GCP project during onboarding for org billing.
- Google is migrating ALL Gemini API access to "auth keys" (service-account-bound OIDC)
  by September 2026 — this aligns with the subscription-first model.

**Availability check:** `which agy` succeeds and an OAuth token is cached in the system
keyring (or user completes browser login on first use).

---

### 3.5 OpenCode ACP (Z.AI)

| | |
|---|---|
| **Command** | `opencode acp` |
| **Package** | `opencode-ai` (npm) or direct binary install |
| **Auth** | API key from Z.AI console (select "Z.AI Coding Plan" during `opencode auth login`) |
| **Billing** | Z.AI GLM Coding Plan: Lite $18/mo, Pro $72/mo, Max $160/mo |
| **ACP version** | Agent Client Protocol |
| **Models** | GLM-5.2, GLM-5.1, GLM-4.7, GLM-5-Turbo |
| **Status** | Active, well-maintained |

**How it works:**

OpenCode is a full coding agent with native ACP support. Authentication uses an API key,
but the billing model is subscription-based (flat monthly fee, not per-token). The Coding
Plan provides a prompt allowance that refreshes monthly.

**Billing details:**
- Lite: ~80 prompts per 5 hours, 400 per week
- GLM-5.2 and GLM-5-Turbo consume 3× quota during peak hours
- Despite being subscription-priced, auth is still API-key-based
- This is the weakest "subscription" story — it's really a prepaid API key with rate limits

**Why include it:** The GLM models are capable for code generation tasks, and the flat
pricing makes costs predictable. At $18/mo for Lite, it's extremely cheap as a fallback
before hitting per-token API billing.

**Availability check:** `opencode --version` succeeds and `opencode auth status` shows
an active Z.AI Coding Plan credential.

---

## 4. Tier 2: Direct API Key Providers (Existing)

Already implemented in `src/providers/`:

| Provider | Env Var | Current Status |
|----------|---------|----------------|
| Anthropic | `ANTHROPIC_API_KEY` | ✅ Implemented (`anthropicProvider.js`) |
| OpenAI | `OPENAI_API_KEY` | ✅ Implemented (`openaiProvider.js`) |

These remain the straightforward fallback. If subscription ACP agents aren't available,
a raw API key still works.

---

## 5. Tier 3: OpenRouter (Unified Fallback)

| | |
|---|---|
| **API format** | OpenAI-compatible |
| **Auth** | `OPENROUTER_API_KEY` |
| **Models** | 400+ models across 70+ providers |
| **Pricing** | Upstream provider rates + 5.5% on credit top-ups |
| **Fallback** | Automatic cross-provider failover |

**Why as last resort:**
- Single API key reaches any model (Claude, GPT, Gemini, Llama, Mistral, etc.)
- Auto-fallback if one provider is down
- Provider preference and price ceiling are configurable per request
- 5.5% markup on credits is the cost of convenience

**Implementation:** Since OpenRouter is OpenAI-compatible, it can reuse the existing
`OpenAiProvider` with a different base URL and API key:

```js
class OpenRouterProvider extends LlmProvider {
    static id = 'openrouter';

    constructor() {
        super();
        const OpenAI = require('openai');
        this.client = new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: 'https://openrouter.ai/api/v1',
        });
        this.defaultModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4';
    }

    static isAvailable() {
        return !!process.env.OPENROUTER_API_KEY;
    }

    // complete() is identical to OpenAiProvider
}
```

---

## 6. Kiro CLI as Self-Provider: The Recursive Question

**Can Kiro CLI be a provider to itself?**

Yes. Here's how it would work:

```
┌──────────────────────────────────────┐
│ Kiro CLI (outer, running this chat)  │
│   ↓ spawns subprocess                │
│   kiro-cli acp                       │
│   ↓ stdio JSON-RPC                   │
│   session/new → session/prompt       │
│   ← AgentMessageChunk stream         │
│   ← TurnEnd                          │
└──────────────────────────────────────┘
```

The outer Kiro session orchestrates the FHIR pipeline. When it needs an LLM completion,
it spawns `kiro-cli acp` as a child process and sends the prompt over JSON-RPC. The child
routes through the Kiro/AWS subscription. Both sessions bill to the same account.

**Advantages:**
- No additional API key or subscription needed — you're already paying for Kiro
- Uses whatever model Kiro's backend selects (currently good enough for FSH generation)
- The child process is sandboxed — it only does what you prompt it to do

**Disadvantages:**
- Two concurrent sessions against one subscription (rate limit implications unclear)
- Heavier than a direct API call — spawns a full agent process for each completion
- Model is server-selected — you can't pin to a specific model (though `session/set_model` exists)
- Adds ~1–2s startup latency per subprocess spawn

**Verdict:** Viable as the first-priority provider. If you're already running inside Kiro,
this is the zero-configuration path. For the repair loop (which may call the LLM 3–5
times), the subprocess overhead is negligible compared to model inference time.

---

## 7. Architecture: ACP Adapter Layer

All ACP providers share the same integration pattern. The adapter spawns a subprocess,
manages the JSON-RPC lifecycle, and extracts the text response:

```js
class AcpAdapter {
    constructor(command, args = []) {
        this.command = command;
        this.args = args;
    }

    async complete(prompt, options = {}) {
        const child = spawn(this.command, this.args, { stdio: ['pipe', 'pipe', 'pipe'] });
        const rpc = new JsonRpcTransport(child.stdin, child.stdout);

        // Initialize
        await rpc.request('initialize', {
            protocolVersion: 1,
            clientCapabilities: {},
            clientInfo: { name: 'fhir-ai-pipeline', version: '1.0.0' },
        });

        // Create session
        const session = await rpc.request('session/new', {
            cwd: process.cwd(),
            mcpServers: [],
        });

        // Send prompt and collect response
        const content = [];
        rpc.onNotification('session/notification', (params) => {
            if (params.type === 'AgentMessageChunk') {
                content.push(params.data.text);
            }
        });

        await rpc.request('session/prompt', {
            sessionId: session.sessionId,
            content: [{ type: 'text', text: prompt }],
        });

        // Wait for TurnEnd
        await rpc.waitForNotification('session/notification',
            (p) => p.type === 'TurnEnd');

        child.kill();

        return {
            content: content.join(''),
            model: 'acp-agent', // ACP doesn't expose model name reliably
            usage: { promptTokens: 0, completionTokens: 0 }, // Not available via ACP
        };
    }
}
```

Each subscription provider is then a thin wrapper:

```js
class KiroAcpProvider extends LlmProvider {
    static id = 'kiro-acp';
    static isAvailable() { return !!which.sync('kiro-cli', { nothrow: true }); }

    constructor() {
        super();
        this.adapter = new AcpAdapter('kiro-cli', ['acp']);
    }

    async complete(prompt, options = {}) {
        return this.adapter.complete(prompt, options);
    }
}
```

---

## 8. Updated Provider Registry

```js
const providers = [
    // Tier 1: Subscription-billed ACP (no API keys needed)
    { name: 'Kiro CLI (ACP)', Provider: KiroAcpProvider },
    { name: 'Claude Agent (ACP)', Provider: ClaudeAcpProvider },
    { name: 'Codex (ACP)', Provider: CodexAcpProvider },
    { name: 'Antigravity (ACP)', Provider: AntigravityAcpProvider },
    { name: 'OpenCode/Z.AI (ACP)', Provider: OpenCodeAcpProvider },

    // Tier 2: Direct API key
    { name: 'Anthropic (Claude)', Provider: AnthropicProvider },
    { name: 'OpenAI (GPT)', Provider: OpenAiProvider },

    // Tier 3: Unified fallback
    { name: 'OpenRouter', Provider: OpenRouterProvider },
];
```

The first available provider wins. Subscription providers check for binary availability
and cached auth tokens. API key providers check env vars. OpenRouter checks its key.

---

## 9. Billing Comparison

| Provider | Monthly Cost | What You Get | Auth Type | Per-Token? |
|----------|-------------|--------------|-----------|------------|
| Kiro CLI | Kiro subscription (TBD) | Whatever Kiro routes | Session-based | No |
| Claude Max 5× | $100/mo | Claude Sonnet/Opus, shared pool | OAuth | No (usage limits) |
| Claude Max 20× | $200/mo | Claude Sonnet/Opus, higher limits | OAuth | No (usage limits) |
| Codex (ChatGPT Pro) | $200/mo | OpenAI models, full Codex agent | OAuth | No |
| Antigravity Pro | Google AI Pro ($$/mo) | Gemini 3.1 Pro + Claude via Google | OAuth | No |
| Z.AI Coding Plan | $18–$160/mo | GLM models, prompt-limited | API key | Sort of (quota) |
| Anthropic API | Pay-per-use | Full model selection | API key | Yes |
| OpenAI API | Pay-per-use | Full model selection | API key | Yes |
| OpenRouter | Pay-per-use + 5.5% | 400+ models | API key | Yes |

---

## 10. Trade-offs: Agent-Level vs Model-Level

All ACP providers are **agent-level** — they own a tool loop, can execute commands, write
files, and make autonomous decisions. The current pipeline architecture expects a
**model-level** interface (`complete(prompt) → text`).

This creates an impedance mismatch:

| Concern | Model-level (current) | Agent-level (ACP) |
|---------|----------------------|-------------------|
| Control | Caller owns all logic | Agent may act autonomously |
| Latency | Single API round-trip | Subprocess spawn + agent startup |
| Token usage | Visible, trackable | Often hidden behind ACP |
| Model selection | Explicit | Determined by agent config |
| Cost predictability | Per-token pricing | Subscription pools |
| Tool execution | None (pure text) | May write files, run commands |

**Mitigation for this project:**
- ACP providers send only text prompts (no tool permissions granted)
- Agent mode set to `read-only` where supported (Codex: `INITIAL_AGENT_MODE=read-only`)
- Responses are text-only — file/shell events are ignored
- The adapter extracts only `AgentMessageChunk` text, discarding tool call events

This effectively uses ACP agents as "expensive model endpoints" — which is exactly the
right trade-off when the goal is subscription billing without API keys.

---

## 11. Implementation Plan

### Phase 1: ACP Adapter Foundation
- [ ] Create `src/providers/acpAdapter.js` — shared JSON-RPC subprocess management
- [ ] Handle process lifecycle (spawn, init, session, prompt, kill)
- [ ] Handle timeouts and error recovery

### Phase 2: Individual ACP Providers
- [ ] `src/providers/kiroAcpProvider.js` — Kiro CLI self-provider
- [ ] `src/providers/claudeAcpProvider.js` — Claude Agent ACP
- [ ] `src/providers/codexAcpProvider.js` — Codex ACP
- [ ] `src/providers/antigravityAcpProvider.js` — Antigravity CLI
- [ ] `src/providers/openCodeAcpProvider.js` — OpenCode/Z.AI

### Phase 3: OpenRouter Fallback
- [ ] `src/providers/openRouterProvider.js` — extends OpenAI provider pattern

### Phase 4: Registry Update
- [ ] Update `src/providers/index.js` with tiered priority
- [ ] Update `.env.example` with new provider options
- [ ] Add `LLM_PROVIDER` override values for each new provider

---

## 12. Open Questions

1. **Rate limits under concurrent sessions:** If Kiro CLI is the orchestrator AND the
   provider (spawning `kiro-cli acp`), does the subscription handle two concurrent
   sessions? Need to test empirically.

2. **Antigravity ACP flag:** Is it `agy --acp` (same as `gemini --acp`) or has the flag
   changed? The official docs don't show it yet. May need to check `agy --help`.

3. **Claude Agent ACP and system prompts:** The Claude Agent SDK uses a system prompt
   internally. Can we override it for FSH-specific instructions, or does the ACP layer
   not expose system prompt control?

4. **Token usage visibility:** ACP doesn't report token consumption. For cost tracking,
   we'd need to estimate based on prompt/response length. Acceptable for subscription
   billing (it's a pool, not per-token), but worth noting.

5. **Process pooling:** Spawning a new subprocess per completion is expensive for the
   repair loop (3–5 iterations). Should the adapter keep a persistent process alive and
   reuse the session? Trade-off: complexity vs. latency.

---

## 13. References

- [Agent Client Protocol](https://agentclientprotocol.com)
- [Kiro CLI ACP docs](https://kiro.dev/docs/cli/acp.html)
- [@agentclientprotocol/claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp)
- [@agentclientprotocol/codex-acp](https://github.com/agentclientprotocol/codex-acp)
- [Gemini CLI ACP mode](https://geminicli.com/docs/cli/acp-mode/)
- [OpenCode ACP docs](https://dev.opencode.ai/docs/acp/)
- [Z.AI Coding Plan](https://docs.z.ai/devpack/overview)
- [OpenRouter](https://openrouter.ai)
- [Vercel AI SDK ACP Provider](https://sdk.vercel.ai/providers/community-providers/acp)
- [Antigravity CLI migration](https://developers.googleblog.com/en/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- [Claude Agent SDK billing (June 2026 update)](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
