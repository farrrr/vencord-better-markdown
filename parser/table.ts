/*
 * GFM Table Parser
 *
 * Parses GitHub Flavored Markdown tables with alignment support.
 * Handles: header row, separator with alignment markers, data rows.
 * Escaped pipes (\|) within cells are preserved.
 */

export interface TableAlignment {
    align: "left" | "center" | "right" | "none";
}

export interface TableData {
    headers: { text: string; align: TableAlignment["align"] }[];
    rows: string[][];
}

// Quick check — avoids full parse for non-table messages
export function detectTable(text: string): boolean {
    return /\|.+\|/.test(text) && /\|[\s:]*-{3,}[\s:]*\|/.test(text);
}

// Split a table row into cells, respecting escaped pipes
function splitRow(line: string): string[] {
    // Remove leading/trailing pipe and whitespace
    let trimmed = line.trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

    const cells: string[] = [];
    let current = "";
    let i = 0;

    while (i < trimmed.length) {
        if (trimmed[i] === "\\" && i + 1 < trimmed.length && trimmed[i + 1] === "|") {
            current += "|";
            i += 2;
        } else if (trimmed[i] === "|") {
            cells.push(current.trim());
            current = "";
            i++;
        } else {
            // Preserve backtick-wrapped content as-is
            if (trimmed[i] === "`") {
                const backtickEnd = trimmed.indexOf("`", i + 1);
                if (backtickEnd !== -1) {
                    current += trimmed.slice(i, backtickEnd + 1);
                    i = backtickEnd + 1;
                    continue;
                }
            }
            current += trimmed[i];
            i++;
        }
    }
    cells.push(current.trim());
    return cells;
}

function parseAlignment(sep: string): TableAlignment["align"] {
    const trimmed = sep.trim();
    const left = trimmed.startsWith(":");
    const right = trimmed.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return "none";
}

// Validate separator row: each cell must be ---+ with optional : on either end
function isValidSeparator(cells: string[]): boolean {
    return cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
}

/**
 * Parse a block of lines as a GFM table.
 * Returns null if the lines don't form a valid table.
 */
export function parseTable(lines: string[]): TableData | null {
    if (lines.length < 2) return null;

    const headerCells = splitRow(lines[0]);
    const sepCells = splitRow(lines[1]);

    if (headerCells.length < 1 || sepCells.length < 1) return null;
    if (!isValidSeparator(sepCells)) return null;

    // Header and separator must have same column count
    // (be lenient: use the header count as canonical)
    const colCount = headerCells.length;

    const alignments = sepCells.map(parseAlignment);
    // Pad alignments if separator has fewer columns
    while (alignments.length < colCount) alignments.push("none");

    const headers = headerCells.map((text, i) => ({
        text,
        align: alignments[i] ?? ("none" as const),
    }));

    const rows: string[][] = [];
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || !line.includes("|")) break;
        const cells = splitRow(line);
        // Normalize row to column count
        const row: string[] = [];
        for (let c = 0; c < colCount; c++) {
            row.push(cells[c] ?? "");
        }
        rows.push(row);
    }

    if (rows.length === 0) return null;

    return { headers, rows };
}

/**
 * Extract table blocks from lines array.
 * Returns indices of lines consumed by tables + parsed data.
 */
export function extractTables(lines: string[]): { start: number; end: number; data: TableData }[] {
    const tables: { start: number; end: number; data: TableData }[] = [];
    let i = 0;

    while (i < lines.length) {
        // Look for potential header row (must contain |)
        if (lines[i].includes("|") && i + 1 < lines.length && lines[i + 1].includes("|")) {
            const sepCells = splitRow(lines[i + 1]);
            if (isValidSeparator(sepCells)) {
                // Found header + separator, now collect data rows
                let end = i + 2;
                while (end < lines.length && lines[end].trim() && lines[end].includes("|")) {
                    end++;
                }
                const tableLines = lines.slice(i, end);
                const data = parseTable(tableLines);
                if (data) {
                    tables.push({ start: i, end, data });
                    i = end;
                    continue;
                }
            }
        }
        i++;
    }

    return tables;
}
