class FshAuthorAgent {

    async authorFsh(profileDesign) {
        let fsh = '';
        fsh += `Profile: ${profileDesign.profileName}\n`;
        fsh += `Parent: ${profileDesign.resourceType}\n\n`;

        profileDesign.constraints.forEach(constraint => {
            const field = constraint.path.split('.')[1];
            fsh += `* ${field} ${constraint.min}..${constraint.max}\n`;

        });
        console.log('\n\n[3/5] FSH Author Agent');
        console.log(fsh);
        return fsh;
    }
}

module.exports = FshAuthorAgent;
