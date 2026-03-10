/*
 * Horizontal Rule Parser
 *
 * Parses ---, ***, ___ (and variants with spaces) as horizontal rules.
 * Must be on a line by itself. Minimum 3 characters of the same type.
 */

const HR_PATTERN = /^[\s]*([-*_])([\s]*\1){2,}[\s]*$/;

export function detectHr(text: string): boolean {
    return /^[\s]*(---+|\*\*\*+|___+)[\s]*$/m.test(text);
}

/**
 * Check if a single line is a horizontal rule.
 */
export function isHrLine(line: string): boolean {
    return HR_PATTERN.test(line);
}

/**
 * Extract horizontal rule lines from a lines array.
 * Each HR is a single-line block (no data payload needed).
 */
export function extractHrs(lines: string[]): { start: number; end: number }[] {
    const hrs: { start: number; end: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (isHrLine(lines[i])) {
            hrs.push({ start: i, end: i + 1 });
        }
    }

    return hrs;
}
