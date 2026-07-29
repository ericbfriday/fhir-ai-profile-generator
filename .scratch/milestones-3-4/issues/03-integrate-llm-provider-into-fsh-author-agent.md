# 03 — Integrate LLM Provider into FSH Author Agent

**What to build:** The FSH Author Agent uses the LLM Provider to author FSH from a Profile Design, replacing the string template. The Agent makes authoring decisions about FSH syntax, style, and idiom — it's not a mechanical formatter. The Pipeline produces a compiled Artifact from LLM-authored FSH.

**Blocked by:** 01 — Implement LLM Provider

**Status:** ready-for-agent

- [ ] FSH Author Agent's `authorFsh` method calls the LLM Provider instead of the string template
- [ ] Prompt instructs the LLM to produce valid FSH expressing the Profile Design's Constraints
- [ ] LLM-authored FSH compiles successfully via SUSHI (at least for the Patient resource happy path)
- [ ] Pipeline runs end-to-end: Source Resource → Architect Agent → FSH Author Agent → SUSHI → compiled Artifact
