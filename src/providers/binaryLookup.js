/**
 * Binary lookup utility — checks if a command exists in PATH.
 * Extracted to allow easy mocking in tests.
 */
const { execSync } = require('child_process');

/**
 * Check whether a binary exists in the system PATH.
 *
 * @param {string} command - The binary name to look up
 * @returns {boolean} true if found, false otherwise
 */
function binaryExists(command) {
    try {
        execSync(`which ${command}`, { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

module.exports = { binaryExists };
