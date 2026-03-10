/*
 * Heading Parser
 *
 * Parses ATX-style headings: # h1 through ###### h6.
 * Discord renders headings but without proper visual hierarchy —
 * this parser enables distinct sizing for each level.
 */

export interface HeadingData {
    level: 1 | 2 | 3 | 4 | 5 | 6;
    text: string;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)(?:\s+#+)?$/;

export function detectHeading(text: string): boolean {
    return /^#{1,6}\s+/m.test(text);
}

/**
 * Check if a single line is a heading.
 */
export function isHeadingLine(line: string): boolean {
    return HEADING_PATTERN.test(line.trim());
}

/**
 * Parse a single heading line.
 * Returns null if the line isn't a valid heading.
 */
export function parseHeading(line: string): HeadingData | null {
    const match = line.trim().match(HEADING_PATTERN);
    if (!match) return null;

    const level = match[1].length;
    if (level < 1 || level > 6) return null;

    return {
        level: level as HeadingData["level"],
        text: match[2].trim(),
    };
}

/**
 * Extract heading lines from a lines array.
 * Each heading is a single-line block.
 */
export function extractHeadings(lines: string[]): { start: number; end: number; data: HeadingData }[] {
    const headings: { start: number; end: number; data: HeadingData }[] = [];

    for (let i = 0; i < lines.length; i++) {
        const data = parseHeading(lines[i]);
        if (data) {
            headings.push({ start: i, end: i + 1, data });
        }
    }

    return headings;
}
