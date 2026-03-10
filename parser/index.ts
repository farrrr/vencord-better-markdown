/*
 * Parser Orchestrator
 *
 * Coordinates all sub-parsers to transform raw message text into
 * an ordered array of typed blocks. Code blocks are protected from
 * parsing. Features can be individually disabled via settings.
 */

import { extractTables, detectTable, type TableData } from "./table";
import { extractTaskLists, detectTaskList, type TaskListData } from "./taskList";
import { extractHeadings, detectHeading, type HeadingData } from "./heading";
import { extractHrs, detectHr } from "./hr";
import {
    extractFootnotes,
    detectFootnotes,
    getFootnoteDefLines,
    replaceFootnoteRefs,
    type FootnoteData,
} from "./footnote";
import { extractBlockquotes, detectNestedBlockquote, type BlockquoteData } from "./blockquote";
import { detectMath, extractMathBlocks, replaceMathInline } from "./math";
import { detectMermaid, extractMermaidBlocks } from "./mermaid";

// Re-export types for consumers
export type { TableData } from "./table";
export type { TaskListData } from "./taskList";
export type { HeadingData } from "./heading";
export type { FootnoteData, FootnoteRef, FootnoteDef } from "./footnote";
export type { BlockquoteData, BlockquoteNode } from "./blockquote";

export interface FeatureFlags {
    enableTables: boolean;
    enableTaskLists: boolean;
    enableHeadings: boolean;
    enableHorizontalRules: boolean;
    enableFootnotes: boolean;
    enableNestedBlockquotes: boolean;
    enableMath: boolean;
    enableMermaid: boolean;
}

export type ParsedBlock =
    | { type: "text"; content: string }
    | { type: "table"; content: TableData }
    | { type: "taskList"; content: TaskListData }
    | { type: "heading"; content: HeadingData }
    | { type: "hr" }
    | { type: "footnoteSection"; content: FootnoteData }
    | { type: "blockquote"; content: BlockquoteData }
    | { type: "mathBlock"; content: { latex: string } }
    | { type: "mermaidBlock"; content: { code: string } };

interface LineRange {
    start: number;
    end: number;
}

/**
 * Fast check: does this message contain any GFM patterns worth parsing?
 * This is the first gate — if false, we skip all parsing (zero overhead).
 */
export function hasGfmPatterns(text: string, flags: FeatureFlags): boolean {
    if (flags.enableTables && detectTable(text)) return true;
    if (flags.enableTaskLists && detectTaskList(text)) return true;
    if (flags.enableHeadings && detectHeading(text)) return true;
    if (flags.enableHorizontalRules && detectHr(text)) return true;
    if (flags.enableFootnotes && detectFootnotes(text)) return true;
    if (flags.enableNestedBlockquotes && detectNestedBlockquote(text)) return true;
    if (flags.enableMath && detectMath(text)) return true;
    if (flags.enableMermaid && detectMermaid(text)) return true;
    return false;
}

/**
 * Identify code block line ranges (``` ... ```) so we can skip them.
 */
function findCodeBlockRanges(lines: string[]): LineRange[] {
    const ranges: LineRange[] = [];
    let inBlock = false;
    let blockStart = 0;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith("```")) {
            if (!inBlock) {
                inBlock = true;
                blockStart = i;
            } else {
                inBlock = false;
                ranges.push({ start: blockStart, end: i + 1 });
            }
        }
    }

    // Unclosed code block — protect everything from start to end
    if (inBlock) {
        ranges.push({ start: blockStart, end: lines.length });
    }

    return ranges;
}

/**
 * Check if a line index falls within a protected range.
 */
function isProtected(lineIndex: number, ranges: LineRange[]): boolean {
    return ranges.some(r => lineIndex >= r.start && lineIndex < r.end);
}

/**
 * Merge overlapping or adjacent line ranges and sort them.
 */
function mergeRanges(ranges: LineRange[]): LineRange[] {
    if (ranges.length === 0) return [];

    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: LineRange[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const last = merged[merged.length - 1];
        if (sorted[i].start <= last.end) {
            last.end = Math.max(last.end, sorted[i].end);
        } else {
            merged.push(sorted[i]);
        }
    }

    return merged;
}

/**
 * Main parse function.
 * Splits message text into an ordered array of typed blocks.
 */
export function parseMessage(text: string, flags: FeatureFlags): ParsedBlock[] {
    const lines = text.split("\n");
    const codeRanges = findCodeBlockRanges(lines);

    // Track which lines are claimed by which feature
    // Each entry: { start, end, block }
    const claimed: { start: number; end: number; block: ParsedBlock }[] = [];

    // --- Extract block-level structures ---

    // Mermaid blocks — extract BEFORE code block protection since we need ```mermaid blocks
    if (flags.enableMermaid) {
        const mermaidBlocks = extractMermaidBlocks(lines);
        for (const mb of mermaidBlocks) {
            claimed.push({
                start: mb.start,
                end: mb.end,
                block: { type: "mermaidBlock", content: { code: mb.code } },
            });
        }
    }

    // Math blocks ($$...$$) — extract BEFORE other parsers to take priority
    if (flags.enableMath) {
        const mathBlocks = extractMathBlocks(lines);
        for (const mb of mathBlocks) {
            if (isProtected(mb.start, codeRanges)) continue;
            claimed.push({
                start: mb.start,
                end: mb.end,
                block: { type: "mathBlock", content: { latex: mb.latex } },
            });
        }
    }

    // Tables
    if (flags.enableTables) {
        const tables = extractTables(lines);
        for (const t of tables) {
            if (!t || isProtected(t.start, codeRanges)) continue;
            claimed.push({ start: t.start, end: t.end, block: { type: "table", content: t.data } });
        }
    }

    // Task lists
    if (flags.enableTaskLists) {
        const taskLists = extractTaskLists(lines);
        for (const tl of taskLists) {
            if (isProtected(tl.start, codeRanges)) continue;
            // Don't claim if already claimed by another feature
            if (claimed.some(c => tl.start >= c.start && tl.start < c.end)) continue;
            claimed.push({ start: tl.start, end: tl.end, block: { type: "taskList", content: tl.data } });
        }
    }

    // Nested blockquotes (only depth >= 2)
    if (flags.enableNestedBlockquotes) {
        const bqs = extractBlockquotes(lines);
        for (const bq of bqs) {
            if (isProtected(bq.start, codeRanges)) continue;
            if (claimed.some(c => bq.start >= c.start && bq.start < c.end)) continue;
            claimed.push({ start: bq.start, end: bq.end, block: { type: "blockquote", content: bq.data } });
        }
    }

    // Headings (single line each)
    if (flags.enableHeadings) {
        const headings = extractHeadings(lines);
        for (const h of headings) {
            if (isProtected(h.start, codeRanges)) continue;
            if (claimed.some(c => h.start >= c.start && h.start < c.end)) continue;
            claimed.push({ start: h.start, end: h.end, block: { type: "heading", content: h.data } });
        }
    }

    // Horizontal rules (single line each)
    if (flags.enableHorizontalRules) {
        const hrs = extractHrs(lines);
        for (const hr of hrs) {
            if (isProtected(hr.start, codeRanges)) continue;
            if (claimed.some(c => hr.start >= c.start && hr.start < c.end)) continue;
            claimed.push({ start: hr.start, end: hr.end, block: { type: "hr" } });
        }
    }

    // Footnote definitions — mark lines to exclude from text blocks
    let footnoteDefLines = new Set<number>();
    let footnoteData: FootnoteData | null = null;
    if (flags.enableFootnotes) {
        footnoteDefLines = getFootnoteDefLines(lines);
        footnoteData = extractFootnotes(text);
    }

    // --- Sort claimed ranges and build output blocks ---
    claimed.sort((a, b) => a.start - b.start);

    const blocks: ParsedBlock[] = [];
    let cursor = 0;

    for (const claim of claimed) {
        // Emit text block for unclaimed lines before this claim
        if (cursor < claim.start) {
            const textLines = lines
                .slice(cursor, claim.start)
                .filter((_, i) => !footnoteDefLines.has(cursor + i));
            const textContent = textLines.join("\n").trim();
            if (textContent) {
                // Apply footnote ref replacement if needed
                let content = footnoteData
                    ? replaceFootnoteRefs(textContent, footnoteData)
                    : textContent;
                // Apply inline math replacement
                if (flags.enableMath) {
                    content = replaceMathInline(content);
                }
                blocks.push({ type: "text", content });
            }
        }

        blocks.push(claim.block);
        cursor = claim.end;
    }

    // Emit trailing text
    if (cursor < lines.length) {
        const textLines = lines
            .slice(cursor)
            .filter((_, i) => !footnoteDefLines.has(cursor + i));
        const textContent = textLines.join("\n").trim();
        if (textContent) {
            let content = footnoteData
                ? replaceFootnoteRefs(textContent, footnoteData)
                : textContent;
            // Apply inline math replacement
            if (flags.enableMath) {
                content = replaceMathInline(content);
            }
            blocks.push({ type: "text", content });
        }
    }

    // Append footnote section at the end if we have definitions
    if (footnoteData && footnoteData.definitions.length > 0) {
        blocks.push({ type: "footnoteSection", content: footnoteData });
    }

    return blocks;
}
