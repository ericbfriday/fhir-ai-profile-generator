const ArchitectAgent = require('../agents/architectAgent')
const FshAuthorAgent = require('../agents/fshAuthorAgent')
const RepairAgent = require('../agents/repairAgent')
const SushiCompiler = require('../compiler/sushiCompiler')

class Orchestrator {

    /**
     * @param {object} [options]
     * @param {number} [options.maxRepairIterations=3] - Maximum Repair Loop iterations before giving up
     */
    constructor(options = {}) {
        this.architect = new ArchitectAgent();
        this.fshAuthor = new FshAuthorAgent();
        this.repairAgent = new RepairAgent();
        this.sushiTool = new SushiCompiler();
        this.maxRepairIterations = options.maxRepairIterations ?? 3;
    }

    async run(patientJson) {
        const profileDesign = await this.architect.createProfileDesign(patientJson);
        console.log('\n\n[2/5] Generated Profile Design');
        console.log( JSON.stringify(profileDesign, null, 2) );
        const fsh = await this.fshAuthor.authorFsh(profileDesign);
        let compilationResult = await this.sushiTool.compile(fsh);

        // Repair Loop — if compilation failed, attempt iterative repair
        if (compilationResult.errors.length > 0) {
            compilationResult = await this._repairLoop(fsh, compilationResult);
        }

        return compilationResult;
    }

    /**
     * Execute the Repair Loop: invoke the Repair Agent, recompile, repeat
     * until success or maxRepairIterations is exhausted.
     *
     * @param {string} originalFsh - The FSH that initially failed
     * @param {import('../models/compilationResult')} initialResult - The initial failed Compilation Result
     * @returns {Promise<import('../models/compilationResult')>} Final Compilation Result
     */
    async _repairLoop(originalFsh, initialResult) {
        let currentFsh = originalFsh;
        let compilationResult = initialResult;
        let attempt = 0;

        try {
            while (attempt < this.maxRepairIterations && compilationResult.errors.length > 0) {
                attempt++;
                const errorCount = compilationResult.errors.length;
                console.log(`\n[Orchestrator] Compilation failed with ${errorCount} error${errorCount !== 1 ? 's' : ''} — entering Repair Loop (attempt ${attempt}/${this.maxRepairIterations})`);

                currentFsh = await this.repairAgent.repairFsh(currentFsh, compilationResult.diagnostics);
                compilationResult = await this.sushiTool.compile(currentFsh);
            }
        } catch (err) {
            console.log(`\n[Orchestrator] Repair Agent unavailable — skipping Repair Loop`);
            return initialResult;
        }

        if (compilationResult.errors.length === 0) {
            console.log(`\n[Orchestrator] Repair succeeded on attempt ${attempt}`);
        } else {
            console.log(`\n[Orchestrator] Repair Loop exhausted (${attempt} attempts) — returning final result`);
        }

        compilationResult.repairAttempt = attempt;
        return compilationResult;
    }
}

module.exports = Orchestrator;
