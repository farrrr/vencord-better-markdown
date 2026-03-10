/*
 * Footnote Parser
 *
 * Parses footnote references [^id] and definitions [^id]: text.
 * References appear inline; definitions are collected and rendered
 * as a section at the bottom of the message.
 */

export interface FootnoteRef {
    id: string;
    index: number;
    position: number; // character position in original text
}

export interface FootnoteDef {
    id: string;
    index: number;
    text: string;
}

export interface FootnoteData {
    refs: FootnoteRef[];
    definitions: FootnoteDef[];
}

const REF_PATTERN = /\[\^([^\]]+)\]/g;
const DEF_PATTERN = /^\[\^([^\]]+)\]:\s+(.+)$/;

export function detectFootnotes(text: string): boolean {
    return /\[\^[^\]]+\]/.test(text);
}

/**
 * Check if a line is a footnote definition.
 */
export function isFootnoteDefLine(line: string): boolean {
    return DEF_PATTERN.test(line.trim());
}

/**
 * Parse footnote definition from a line.
 */
export function parseFootnoteDef(line: string): { id: string; text: string } | null {
    const match = line.trim().match(DEF_PATTERN);
    if (!match) return null;
    return { id: match[1], text: match[2] };
}

/**
 * Extract all footnote references and definitions from the full message text.
 * This parser works on the complete text, not individual lines,
 * because references are inline.
 */
export function extractFootnotes(text: string): FootnoteData | null {
    const lines = text.split("\n");

    // Collect definitions
    const defMap = new Map<string, string>();
    const defLineIndices = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
        const def = parseFootnoteDef(lines[i]);
        if (def) {
            // Support multi-line definitions: subsequent indented lines
            let fullText = def.text;
            let j = i + 1;
            while (j < lines.length && lines[j].match(/^\s{2,}/) && !isFootnoteDefLine(lines[j])) {
                fullText += " " + lines[j].trim();
                defLineIndices.add(j);
                j++;
            }
            defMap.set(def.id, fullText);
            defLineIndices.add(i);
        }
    }

    if (defMap.size === 0) return null;

    // Collect references in order of appearance
    const seenIds = new Map<string, number>(); // id -> index
    const refs: FootnoteRef[] = [];
    let counter = 0;

    // Remove definition lines from text for reference scanning
    // (definitions themselves contain [^id] which we don't want to count as refs)
    const nonDefText = lines
        .filter((_, i) => !defLineIndices.has(i))
        .join("\n");

    let match: RegExpExecArray | null;
    const refRegex = new RegExp(REF_PATTERN.source, "g");

    while ((match = refRegex.exec(nonDefText)) !== null) {
        const id = match[1];
        // Only count refs that have matching definitions
        if (!defMap.has(id)) continue;

        if (!seenIds.has(id)) {
            counter++;
            seenIds.set(id, counter);
        }
        refs.push({
            id,
            index: seenIds.get(id)!,
            position: match.index,
        });
    }

    if (refs.length === 0) return null;

    // Build ordered definitions list
    const definitions: FootnoteDef[] = [];
    for (const [id, index] of seenIds) {
        definitions.push({
            id,
            index,
            text: defMap.get(id)!,
        });
    }

    return { refs, definitions };
}

/**
 * Get line indices of footnote definitions (to exclude from normal rendering).
 */
export function getFootnoteDefLines(lines: string[]): Set<number> {
    const indices = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
        if (isFootnoteDefLine(lines[i])) {
            indices.add(i);
            // Multi-line continuation
            let j = i + 1;
            while (j < lines.length && lines[j].match(/^\s{2,}/) && !isFootnoteDefLine(lines[j])) {
                indices.add(j);
                j++;
            }
        }
    }

    return indices;
}

/**
 * Replace inline footnote references with numbered superscripts.
 * Returns the text with [^id] replaced by markers that components can render.
 * Uses a placeholder format: {{FN:index:id}}
 */
export function replaceFootnoteRefs(text: string, data: FootnoteData): string {
    const idToIndex = new Map(data.refs.map(r => [r.id, r.index]));

    return text.replace(/\[\^([^\]]+)\]/g, (match, id) => {
        const index = idToIndex.get(id);
        if (index === undefined) return match; // No matching def, leave as-is
        return `{{FN:${index}:${id}}}`;
    });
}
