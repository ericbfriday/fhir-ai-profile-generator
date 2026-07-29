// SUSHI compiler Tool — mechanically executes SUSHI and captures its output.

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const CompilationResult = require("../models/compilationResult");
const { parseDiagnostics } = require("../models/diagnostic");

const execPromise = util.promisify(exec);

class SushiCompiler {

    async compile(fshInput) {
        console.log("\n\n[4/5] Running SUSHI Compiler");

        const sushiProjectPath = path.join(
            __dirname,
            "../../sushi-project"
        );

        const fshPath = path.join(
            sushiProjectPath,
            "input/fsh/ai-generated-patient.fsh"
        );

        fs.writeFileSync(
            fshPath,
            fshInput
        );

        try {
            const { stdout, stderr } = await execPromise(
                'npx sushi .',
                {
                    cwd: sushiProjectPath,
                }
            );
            const artifacts = this.discoverArtifacts(sushiProjectPath);
            const diagnostics = parseDiagnostics(stdout + '\n' + stderr);
            this.saveExecutionLogs(fshInput, stdout, stderr);
            return new CompilationResult(true, stdout, stderr, diagnostics, artifacts);
        } catch (error) {
            const stdout = error.stdout || '';
            const stderr = error.stderr || '';
            const diagnostics = parseDiagnostics(stdout + '\n' + stderr);
            this.saveExecutionLogs(fshInput, stdout, stderr);
            return new CompilationResult(false, stdout, stderr, diagnostics);
        }
    }

    // Find generated Artifacts for Compilation Result
    discoverArtifacts(sushiProjectPath) {
        const artifactPath = path.join(sushiProjectPath, 'fsh-generated/resources');
        if (!fs.existsSync(artifactPath)) {
            return [];
        }
        return fs.readdirSync(artifactPath)
            .filter(file => file.endsWith('.json'));
    }

    saveExecutionLogs(fshInput, stdout, stderr) {
        const logsPath = path.join(
            __dirname,
            "../../logs"
        );

        if (!fs.existsSync(logsPath)) {
            fs.mkdirSync(logsPath, { recursive: true });
        }

        const compilerLogPath = path.join(
            logsPath,
            "sushi-output.log"
        );

        fs.writeFileSync(
            compilerLogPath,
            stdout + "\n\nSTDERR\n\n" + stderr
        );

        const generatedFshPath = path.join(
            logsPath,
            "generated.fsh"
        );
        fs.writeFileSync(
            generatedFshPath,
            fshInput
        );
    }
}

module.exports = SushiCompiler;
