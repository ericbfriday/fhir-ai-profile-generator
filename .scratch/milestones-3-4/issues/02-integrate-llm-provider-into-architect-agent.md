# 02 — Integrate LLM Provider into Architect Agent

**What to build:** The Architect Agent uses the LLM Provider to analyze a Source Resource and produce a Profile Design, replacing the hardcoded cardinality rules. Given a Patient JSON input, the Architect Agent reasons about which Constraints the Profile should express — cardinality, Must Support flags, fixed values — using LLM-powered domain reasoning. The Pipeline still compiles the resulting FSH successfully via SUSHI.

**Blocked by:** 01 — Implement LLM Provider

**Status:** ready-for-agent

- [ ] Architect Agent's `createProfileDesign` method calls the LLM Provider instead of the hardcoded rule engine
- [ ] Prompt instructs the LLM to produce a structured Profile Design (resource type, profile name, constraints)
- [ ] Output Profile Design is compatible with the FSH Author Agent's expected input shape
- [ ] Pipeline runs end-to-end: LLM-generated Profile Design → FSH Author → SUSHI → compiled Artifact
