class ArchitectAgent {

    async createProfileDesign(patientJson) {
        console.log('\n\n[1/5] Architect Agent');
        console.log('Received - ', patientJson.resourceType);

        // Rules for cardinality
        // Temporary rule engine.
        // Future implementation will replace this logic with LLM-generated profile reasoning.
        const cardinalityRules = {
            identifier: {
                min: 1,
                max: "*"
            },
            name: {
                min: 1,
                max: "*"
            },
            gender: {
                min: 0,
                max: "1"
            },
            birthDate: {
                min: 0,
                max: "1"
            }
        };

        const fieldsFound = [];

        // ensure cardinality for each field found
        Object.keys(cardinalityRules).forEach(field => {
            if (patientJson[field]) {
                fieldsFound.push(field);
            }
        });


        console.log('Found fields :' ,fieldsFound);

        return {
            resourceType: patientJson.resourceType,
            profileName: 'Generated' + patientJson.resourceType,
            fieldsFound,
            constraints:
            fieldsFound.map(field => {
                return {
                    path: `${patientJson.resourceType}.${field}`,
                    min: cardinalityRules[field].min,
                    max: cardinalityRules[field].max
                };
            })
        };
    }

}

module.exports = ArchitectAgent;
