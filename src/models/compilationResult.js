class CompilationResult {

    constructor (success, output, diagnostics, artifacts = []) {
        this.success = success;
        this.output = output;
        this.diagnostics = diagnostics;
        this.artifacts = artifacts;
    }
}

module.exports = CompilationResult;
