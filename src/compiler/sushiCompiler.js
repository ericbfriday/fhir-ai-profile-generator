// This will create a .fsh file that can be used as input for SUSHI in the future

const {exec} = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const CompilationResult = require("../models/compilationResult");

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
            const {stdout, stderr } = await execPromise(
                'npx sushi .',
                {
                    cwd: sushiProjectPath,
                }
            );
            const artifacts = this.discoverArtifacts(sushiProjectPath);
            this.saveExecutionLogs(fshInput, stdout, stderr);
            return new CompilationResult(true, stdout, stderr, artifacts);
        } catch (error) {
            this.saveExecutionLogs(fshInput, error.stdout, error.stderr);
            return new CompilationResult(false, error.stdout, error.stderr);
        }
    }

    // Find generated artifacts for compilation result
    discoverArtifacts(sushiProjectPath) {
        const artifactPath = path.join( sushiProjectPath, 'fsh-generated/resources');
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
