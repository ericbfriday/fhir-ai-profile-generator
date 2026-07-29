# 06 — Implement Repair Loop in Orchestrator

**What to build:** The Orchestrator implements the Repair Loop: after initial compilation, if the Compilation Result contains error-level Diagnostics, the Orchestrator invokes the Repair Agent with the failing FSH and Diagnostics, then recompiles. This repeats until compilation succeeds or a configurable maximum iteration count is reached. The full Pipeline can recover from initially-invalid LLM-generated FSH without human intervention.

**Blocked by:** 05 — Implement Repair Agent

**Status:** ready-for-agent

- [ ] Orchestrator detects compilation failure and enters the Repair Loop
- [ ] Repair Loop invokes Repair Agent → recompiles → checks result, iterating as needed
- [ ] Maximum iteration count is configurable (sensible default, e.g., 3)
- [ ] Pipeline exits gracefully when max iterations are exhausted (reports final Diagnostics, does not throw)
- [ ] Pipeline reports which iteration succeeded (if any) in its final output
- [ ] Happy path: LLM-generated FSH that initially fails compilation is repaired and produces a valid Artifact
