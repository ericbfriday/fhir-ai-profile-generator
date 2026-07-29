# 01 — Implement LLM Provider

**What to build:** A Provider abstraction that Agents call to get LLM completions. The Provider encapsulates model/vendor selection strategy (picks the correct LLM based on availability and the requesting Agent's needs) and exposes a stable interface so Agents never call an LLM directly. The first concrete implementation connects via Kiro CLI through ACP (Agent Communication Protocol).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Provider exposes a stable interface that Agents can call for completions
- [ ] Provider implements model/vendor selection strategy (can be simple initial heuristic)
- [ ] First implementation connects via Kiro CLI / ACP
- [ ] At least one Agent can call the Provider and receive a response
- [ ] Provider handles unavailability gracefully (clear error, no silent fallback to wrong model)
