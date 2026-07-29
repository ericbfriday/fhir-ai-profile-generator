# 04 — Capture structured Diagnostics from Compilation Result

**What to build:** When SUSHI compilation fails, the Pipeline extracts structured Diagnostics from SUSHI's output — file path, line number, severity (error/warning/info), and message — rather than passing raw stderr as an opaque string. The Diagnostics are available on the Compilation Result for downstream consumption by the Repair Agent.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] SUSHI stderr/stdout is parsed into structured Diagnostic objects (file, line, severity, message)
- [ ] Compilation Result exposes a `diagnostics` array of structured objects (not raw string)
- [ ] Both success and failure cases are handled (success may still have warnings)
- [ ] Existing Pipeline behavior is preserved — parsing is additive, not a breaking change
