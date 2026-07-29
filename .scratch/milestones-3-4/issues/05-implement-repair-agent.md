# 05 — Implement Repair Agent

**What to build:** A new Repair Agent that receives structured Diagnostics and failing FSH, uses the LLM Provider to reason about what's wrong, and produces corrected FSH. The Repair Agent is an Agent (makes domain decisions about how to fix the FSH) not a Tool. It can be tested in isolation: given known-bad FSH and its Diagnostics, it produces FSH that compiles cleanly.

**Blocked by:** 03 — Integrate LLM Provider into FSH Author Agent, 04 — Capture structured Diagnostics

**Status:** ready-for-agent

- [ ] Repair Agent class exists with a method that accepts failing FSH + structured Diagnostics
- [ ] Repair Agent calls the LLM Provider with a prompt that includes the FSH and Diagnostics
- [ ] Produces corrected FSH as output
- [ ] Corrected FSH compiles successfully via SUSHI when given known failure cases
- [ ] Repair Agent does not re-architect the Profile Design — it fixes syntax/structure issues only
