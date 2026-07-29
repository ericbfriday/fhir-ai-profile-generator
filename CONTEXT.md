# FHIR AI Profile Generator

An AI-assisted framework that generates FHIR Profiles from example resource instances using the standard HL7 tooling ecosystem.

## Language

### Pipeline Concepts

**Pipeline**:
The complete end-to-end generation workflow, from Source Resource input to compiled Artifact output. A concept, not a class — the Orchestrator executes the Pipeline.
_Avoid_: workflow (in formal usage)

**Orchestrator**:
The component that owns the Pipeline's control flow — sequences Agents and Tools, decides when to loop, assembles the final result. Makes no domain decisions itself.
_Avoid_: runner, pipeline (as a class name)

**Agent**:
A pipeline stage that applies domain reasoning to transform its input. Distinguished from a Tool by the fact that it makes domain decisions.
_Avoid_: service, handler, processor

**Tool**:
A pipeline component that mechanically executes an external process and captures its output. Makes no domain decisions.
_Avoid_: agent (for mechanical components), service

### Agents

**Architect Agent**:
The Agent that analyzes a Source Resource and produces a Profile Design. Decides what Constraints the Profile should express, without concern for FSH syntax.
_Avoid_: analyzer, planner

**FSH Author Agent**:
The Agent that receives a Profile Design and produces FSH expressing its Constraints. Makes authoring decisions about syntax, style, and idiom.
_Avoid_: generator, writer, translator

**Repair Agent**:
An Agent that receives Diagnostics and failing FSH, then produces corrected FSH.
_Avoid_: fixer

### FHIR & HL7 Tooling

**Profile**:
A StructureDefinition that constrains a base FHIR resource type.
_Avoid_: generated profile (as a distinct noun)

**FSH**:
A grammar for defining FHIR profiles, extensions, value sets, and other conformance resources in a human-readable text format.
_Avoid_: spelling out "FHIR Shorthand" in code or domain conversations

**SUSHI**:
The HL7 reference compiler that transforms FSH into FHIR conformance resources.
_Avoid_: calling it an agent

**Constraint**:
Any restriction a Profile imposes on a base FHIR resource element — including cardinality, Must Support flags, fixed values, terminology bindings, and invariants.
_Avoid_: rule (ambiguous with business rules)

**Implementation Guide**:
A published, versioned package of Profiles, value sets, examples, and narrative documentation that defines how FHIR is used for a specific use case. ⚠️ *Future scope.*
_Avoid_: IG (in prose — fine in filenames and tool references)

### Pipeline Data Flow

**Source Resource**:
A FHIR resource instance (JSON) provided as input to the Pipeline. The Pipeline analyzes it to infer what Constraints a Profile should express. ⚠️ *Name provisional — revisit if a more natural term emerges.*
_Avoid_: input (too generic), example (collides with FHIR Example instances), sample

**Profile Design**:
The structured output of the Architect Agent describing what Constraints a Profile should express, before FSH is generated. Captures the what without the how.
_Avoid_: specification (too overloaded with HL7/FHIR specs), schema, plan

**Compilation Result**:
The full outcome of a SUSHI run: success/failure status, generated Artifacts, and Diagnostics.
_Avoid_: compiler output (ambiguous), errors (too narrow)

**Diagnostics**:
The warnings and errors emitted by SUSHI that describe problems with the input FSH. This is what the Repair Agent consumes.
_Avoid_: errors (excludes warnings)

**Artifact**:
A FHIR conformance resource file produced by SUSHI during compilation (e.g., a StructureDefinition JSON file). The Pipeline's final deliverable. ⚠️ *Revisit boundary when Implementation Guide scope is introduced.*
_Avoid_: output file (too vague), resource (collides with FHIR Resource)

### Control Flow

**Repair Loop**:
The Orchestrator's iterative control flow: compile, inspect Diagnostics, invoke the Repair Agent, recompile. Repeats until compilation succeeds or a maximum iteration count is reached.
_Avoid_: feedback loop (too generic), retry (implies same input, not fixed input)

### Future Protocols

**MCP**:
Model Context Protocol. A protocol that allows LLMs to invoke external tools. Future iterations will expose the Pipeline's Tools as MCP servers. ⚠️ *Future scope.*

**ACP**:
Agent Communication Protocol. A protocol for multi-agent collaboration. Future iterations will use ACP to enable Agents to negotiate and coordinate. ⚠️ *Future scope.*
