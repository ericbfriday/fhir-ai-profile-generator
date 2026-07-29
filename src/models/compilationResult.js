/**
 * The full outcome of a SUSHI run: success/failure status, generated Artifacts,
 * and structured Diagnostics parsed from compiler output.
 */
class CompilationResult {

    /**
     * @param {boolean} success - Whether compilation succeeded
     * @param {string} stdout - Raw SUSHI stdout
     * @param {string} stderr - Raw SUSHI stderr
     * @param {import('./diagnostic').Diagnostic[]} diagnostics - Structured Diagnostics parsed from output
     * @param {string[]} artifacts - Generated Artifact filenames
     */
    constructor(success, stdout, stderr, diagnostics = [], artifacts = []) {
        this.success = success;
        this.stdout = stdout;
        this.stderr = stderr;
        this.diagnostics = diagnostics;
        this.artifacts = artifacts;
    }

    /** @returns {import('./diagnostic').Diagnostic[]} Diagnostics with severity 'error' */
    get errors() {
        return this.diagnostics.filter(d => d.severity === 'error');
    }

    /** @returns {import('./diagnostic').Diagnostic[]} Diagnostics with severity 'warn' */
    get warnings() {
        return this.diagnostics.filter(d => d.severity === 'warn');
    }
}

module.exports = CompilationResult;
