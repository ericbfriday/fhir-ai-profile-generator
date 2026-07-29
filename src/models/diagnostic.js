/**
 * A structured Diagnostic extracted from SUSHI compiler output.
 *
 * Represents a single warning, error, or info message emitted by SUSHI,
 * with file path, line number, severity, and message extracted from the raw output.
 */
class Diagnostic {

    /**
     * @param {'error' | 'warn' | 'info'} severity
     * @param {string | null} file - Source FSH file path (may be null for general messages)
     * @param {number | null} line - Line number in the source file (may be null)
     * @param {string} message - The diagnostic message text
     */
    constructor(severity, file, line, message) {
        this.severity = severity;
        this.file = file;
        this.line = line;
        this.message = message;
    }

    toString() {
        const location = this.file
            ? `${this.file}${this.line ? ':' + this.line : ''}`
            : '(no file)';
        return `[${this.severity}] ${location} - ${this.message}`;
    }
}

/**
 * Parse SUSHI stdout/stderr output into an array of structured Diagnostic objects.
 *
 * SUSHI emits lines in formats like:
 *   error  path/to/file.fsh:12 - Some error message
 *   warn   path/to/file.fsh:5 - Some warning message
 *   info   Some general info message
 *   error  Some error without a file reference
 *
 * @param {string} output - Raw SUSHI stdout or stderr text
 * @returns {Diagnostic[]} Array of parsed Diagnostic objects
 */
function parseDiagnostics(output) {
    if (!output) {
        return [];
    }

    const diagnostics = [];

    // Match SUSHI diagnostic lines:
    // severity  [file:line] - message
    // severity  [file] - message
    // severity  message (no file reference)
    const diagnosticPattern = /^(error|warn|info)\s+(.+)$/;
    const fileLocationPattern = /^(.+?\.fsh):(\d+)\s*-\s*(.+)$/;
    const fileNoLinePattern = /^(.+?\.fsh)\s*-\s*(.+)$/;
    const messageOnlyPattern = /^-?\s*(.+)$/;

    const lines = output.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(diagnosticPattern);

        if (!match) {
            continue;
        }

        const severity = match[1];
        const rest = match[2];

        // Try: file.fsh:line - message
        const fileLineMatch = rest.match(fileLocationPattern);
        if (fileLineMatch) {
            diagnostics.push(new Diagnostic(
                severity,
                fileLineMatch[1],
                parseInt(fileLineMatch[2], 10),
                fileLineMatch[3].trim()
            ));
            continue;
        }

        // Try: file.fsh - message (no line number)
        const fileMatch = rest.match(fileNoLinePattern);
        if (fileMatch) {
            diagnostics.push(new Diagnostic(
                severity,
                fileMatch[1],
                null,
                fileMatch[2].trim()
            ));
            continue;
        }

        // Fallback: just a message with no file reference
        const msgMatch = rest.match(messageOnlyPattern);
        if (msgMatch) {
            diagnostics.push(new Diagnostic(
                severity,
                null,
                null,
                msgMatch[1].trim()
            ));
        }
    }

    return diagnostics;
}

module.exports = { Diagnostic, parseDiagnostics };
