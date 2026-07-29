const Orchestrator = require('./orchestrator/orchestrator');

async function main() {
    try {
        console.log('\n\n=========================================================\n' +
            'FHIR AI Profile Generator\n' +
            'HL7 FHIR + AI Challenge 2026\n' +
            'AI-assisted FHIR Profile Generation using FSH + SUSHI\n' +
            '=========================================================')
        const orchestrator = new Orchestrator();
        const patient = require('../examples/patient.json');
        const compilationResult = await orchestrator.run(patient);
        if(compilationResult.success) {
            console.log("\n\n[5/5] Pipeline Summary\n");
            console.log("Success :", compilationResult.success);
            console.log("\nGenerated Artifacts:");
            console.log("-------------------");
            compilationResult.artifacts.forEach(file => {
                console.log(" -", file);
            });
            console.log('\n\nGenerated Files:');
            console.log('----------------');
            console.log(' - logs/generated.fsh');
            console.log(' - logs/sushi-output.log');
            console.log(' - sushi-project/fsh-generated/resources/StructureDefinition-GeneratedPatient.json');
            console.log('\n\nPipeline completed successfully.');
            console.log('FHIR profile generated and compiled using the HL7 SUSHI toolchain.');
        }
        else {
            console.log("\n\n[5/5] Pipeline Failure");
            console.log('Success :', compilationResult.success );
            console.log(compilationResult.diagnostics);
        }
    } catch (error) {
        console.log(error);
    }
}

main();
