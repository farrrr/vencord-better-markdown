/*
 * Mermaid Parser
 *
 * Detects and extracts ```mermaid fenced code blocks.
 * Returns the diagram source code for rendering by the Mermaid component.
 */

export interface MermaidBlockMatch {
    start: number;
    end: number;
    code: string;
}

/**
 * Fast detect: does this text contain a ```mermaid code block?
 */
export function detectMermaid(text: string): boolean {
    return /```mermaid\s*\n/i.test(text);
}

/**
 * Extract ```mermaid ... ``` blocks from lines.
 * Returns ranges and the diagram source code.
 */
export function extractMermaidBlocks(lines: string[]): MermaidBlockMatch[] {
    const matches: MermaidBlockMatch[] = [];
    let i = 0;

    while (i < lines.length) {
        const trimmed = lines[i].trim();

        if (/^```mermaid\s*$/i.test(trimmed)) {
            const startLine = i;
            let found = false;

            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() === "```") {
                    const contentLines = lines.slice(startLine + 1, j);
                    const code = contentLines.join("\n").trim();
                    if (code) {
                        matches.push({ start: startLine, end: j + 1, code });
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
