/*
 * Nested Blockquote Parser
 *
 * Discord renders single-level blockquotes (> text) but doesn't
 * properly handle nested blockquotes (> > text).
 * This parser detects nesting depth and structures it for
 * visual indentation rendering.
 */

export interface BlockquoteNode {
    depth: number;
    lines: string[];
    children: BlockquoteNode[];
}

export interface BlockquoteData {
    root: BlockquoteNode;
    maxDepth: number;
}

const QUOTE_PREFIX = /^((?:>\s*)+)/;

export function detectNestedBlockquote(text: string): boolean {
    // Only trigger for nested quotes (depth >= 2)
    return /^>\s*>\s*/m.test(text);
}

/**
 * Get the blockquote depth of a line.
 * `> text` = 1, `> > text` = 2, etc.
 */
function getQuoteDepth(line: string): number {
    const match = line.match(QUOTE_PREFIX);
    if (!match) return 0;
    // Count the number of > characters
    return (match[1].match(/>/g) || []).length;
}

/**
 * Strip blockquote markers from a line, returning the content.
 */
function stripQuoteMarkers(line: string): string {
    return line.replace(/^(>\s*)+/, "");
}

/**
 * Strip a specific number of quote levels from a line.
 */
function stripNLevels(line: string, n: number): string {
    let result = line;
    for (let i = 0; i < n; i++) {
        result = result.replace(/^>\s*/, "");
    }
    return result;
}

/**
 * Build a blockquote tree from consecutive quoted lines.
 */
function buildQuoteTree(lines: string[], baseDepth: number = 0): BlockquoteNode {
    const root: BlockquoteNode = {
        depth: baseDepth,
        lines: [],
        children: [],
    };

    let i = 0;
    while (i < lines.length) {
        const depth = getQuoteDepth(lines[i]);

        if (depth <= baseDepth) {
            // This line is at or above our level — it's just text at this level
            root.lines.push(stripNLevels(lines[i], baseDepth));
            i++;
        } else if (depth === baseDepth + 1) {
            // Direct child content
            // Collect consecutive lines at this depth or deeper
            const childLines: string[] = [];
            while (i < lines.length && getQuoteDepth(lines[i]) > baseDepth) {
                childLines.push(stripNLevels(lines[i], baseDepth + 1));
                i++;
            }

            // Check if child has further nesting
            const hasNesting = childLines.some(l => getQuoteDepth(l) > 0);
            if (hasNesting) {
                const child = buildQuoteTree(
                    childLines.map((l, _) => {
                        // Re-add quote markers for sub-parsing
                        const d = getQuoteDepth(l);
                        return d > 0 ? l : l;
                    }),
                    0
                );
                child.depth = baseDepth + 1;
                root.children.push(child);
            } else {
                root.children.push({
                    depth: baseDepth + 1,
                    lines: childLines,
                    children: [],
                });
            }
        } else {
            // Deeper nesting — collect and recurse
            const childLines: string[] = [];
            while (i < lines.length && getQuoteDepth(lines[i]) > baseDepth) {
                childLines.push(lines[i]);
                i++;
            }
            const child = buildQuoteTree(childLines, baseDepth + 1);
            root.children.push(child);
        }
    }

    return root;
}

/**
 * Parse a block of lines as nested blockquotes.
 * Returns null if no nesting detected (single-level quotes
 * are handled fine by Discord's default renderer).
 */
export function parseBlockquote(lines: string[]): BlockquoteData | null {
    // Check for actual nesting
    let maxDepth = 0;
    for (const line of lines) {
        const depth = getQuoteDepth(line);
        if (depth > maxDepth) maxDepth = depth;
    }

    if (maxDepth < 2) return null; // No nesting, let Discord handle it

    const root = buildQuoteTree(lines, 0);

    return { root, maxDepth };
}

/**
 * Extract nested blockquote blocks from lines.
 * Only extracts blocks with nesting depth >= 2.
 */
export function extractBlockquotes(lines: string[]): { start: number; end: number; data: BlockquoteData }[] {
    const blocks: { start: number; end: number; data: BlockquoteData }[] = [];
    let i = 0;

    while (i < lines.length) {
        const depth = getQuoteDepth(lines[i]);
        if (depth >= 1) {
            const start = i;
            // Collect all consecutive quoted lines
            while (i < lines.length && getQuoteDepth(lines[i]) >= 1) {
                i++;
            }

            const blockLines = lines.slice(start, i);
            const data = parseBlockquote(blockLines);
            if (data) {
                blocks.push({ start, end: i, data });
            }
        } else {
            i++;
        }
    }

    return blocks;
}
