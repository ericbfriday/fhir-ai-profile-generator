const ArchitectAgent = require('../agents/architectAgent')
const FshAuthorAgent = require('../agents/fshAuthorAgent')
const SushiCompiler = require('../compiler/sushiCompiler')

class Orchestrator {

    constructor() {
        this.architect = new ArchitectAgent();
        this.fshAuthor = new FshAuthorAgent();
        this.sushiTool = new SushiCompiler();
    }

    async run(patientJson) {
        const profileDesign = await this.architect.createProfileDesign(patientJson);
        console.log('\n\n[2/5] Generated Profile Design');
        console.log( JSON.stringify(profileDesign, null, 2) );
        const fsh = await this.fshAuthor.authorFsh(profileDesign);
        const compilationResult = await this.sushiTool.compile(fsh)

        return compilationResult;
    }
}

module.exports = Orchestrator;
