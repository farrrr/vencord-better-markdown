/*
 * Math Parser
 *
 * Detects and extracts LaTeX math expressions:
 * - Block math: $$...$$ (display mode, on own line/paragraph)
 * - Inline math: $...$ (inline mode, no space after opening/before closing)
 *
 * Code spans (backtick-wrapped) are skipped to avoid false positives.
 * Block math takes priority over inline math.
 */

export interface MathBlockMatch {
    start: number;
    end: number;
    latex: string;
}

/**
 * Fast detect: does this text contain any math patterns?
 * Checks for $$ (block) or $ (inline) outside backticks.
 */
export function detectMath(text: string): boolean {
    // Strip inline code spans before checking
    const stripped = text.replace(/`[^`]+`/g, "");
    // Block math: $$...$$
    if (/\$\$[\s\S]+?\$\$/.test(stripped)) return true;
    // Inline math: $...$ with non-space boundaries and non-empty content
    if (/\$[^\s$][^$]*[^\s$]\$|\$[^\s$]\$/.test(stripped)) return true;
    return false;
}

/**
 * Extract block math ($$...$$) from lines.
 * Returns ranges of lines that form block math expressions.
 * Block math must start with $$ on its own line (possibly with content)
 * and end with $$ on its own line.
 */
export function extractMathBlocks(lines: string[]): MathBlockMatch[] {
    const matches: MathBlockMatch[] = [];
    let i = 0;

    while (i < lines.length) {
        const trimmed = lines[i].trim();

        // Single-line block math: $$...$$  on one line
        if (/^\$\$.+\$\$$/.test(trimmed)) {
            const latex = trimmed.slice(2, -2).trim();
            if (latex) {
                matches.push({ start: i, end: i + 1, latex });
            }
            i++;
            continue;
        }

        // Multi-line block math: starts with $$
        if (trimmed === "$$" || trimmed.startsWith("$$")) {
            const startLine = i;
            // If the line is exactly "$$", content starts on next line
            // If the line starts with "$$" but has more, content is on this line
            const isOpenOnly = trimmed === "$$";

            let found = false;
            for (let j = isOpenOnly ? i + 1 : i; j < lines.length; j++) {
                // Skip the opening line itself for end-marker search
                if (j === startLine && isOpenOnly) continue;

                const jTrimmed = lines[j].trim();
                if (jTrimmed === "$$" || (j !== startLine && jTrimmed.endsWith("$$"))) {
                    // Collect latex content
                    const contentLines: string[] = [];
                    for (let k = startLine; k <= j; k++) {
                        contentLines.push(lines[k]);
                    }
                    let latex = contentLines.join("\n");
                    // Strip leading/trailing $$
                    latex = latex.replace(/^\s*\$\$\s*/, "").replace(/\s*\$\$\s*$/, "").trim();
                    if (latex) {
                        matches.push({ start: startLine, end: j + 1, latex });
                    }
                    i = j + 1;
                    found = true;
                    break;
                }
            }
            if (!found) {
                i++;
            }
            continue;
        }

        i++;
    }

    return matches;
}

/**
 * Replace inline math ($...$) in a text string with placeholders.
 * Returns the text with $...$ replaced by {{MATH:base64latex}} markers.
 *
 * Rules:
 * - Content must be non-empty
 * - No space after opening $, no space before closing $
 * - Skip content inside backticks
 * - Don't match $$ (those are block math)
 *
 * Uses base64 encoding to safely embed LaTeX in the placeholder
 * (LaTeX can contain special chars like }, :, etc.)
 */
export function replaceMathInline(text: string): string {
    // First, protect inline code spans by replacing them with placeholders
    const codeSpans: string[] = [];
    let protected_ = text.replace(/`[^`]+`/g, match => {
        codeSpans.push(match);
        return `\x00CODE${codeSpans.length - 1}\x00`;
    });

    // Match inline math: $content$ where content has no leading/trailing space
    // Negative lookbehind for $ (avoid matching $$)
    // Negative lookahead for $ (avoid matching $$)
    protected_ = protected_.replace(
        /(?<!\$)\$(?!\$)([^\s$](?:[^$]*[^\s$])?)\$(?!\$)/g,
        (_match, latex: string) => {
            const encoded = btoa(unescape(encodeURIComponent(latex)));
            return `{{MATH:${encoded}}}`;
        }
    );

    // Restore code spans
    protected_ = protected_.replace(/\x00CODE(\d+)\x00/g, (_match, idx) => {
        return codeSpans[parseInt(idx, 10)];
    });

    return protected_;
}

/**
 * Decode a base64-encoded LaTeX string from a math placeholder.
 */
export function decodeMathPlaceholder(encoded: string): string {
    try {
        return decodeURIComponent(escape(atob(encoded)));
    } catch {
        return encoded;
    }
}
