/*
 * Shared Utilities for Components
 *
 * Provides renderInline() which uses Discord's own markdown parser
 * for inline formatting (bold, italic, code, links, emoji, etc.)
 * within our custom block-level components.
 */

import { findByPropsLazy } from "@webpack";
import { Parser } from "@webpack/common";
import { FootnoteRef } from "./Footnote";
import { MathInline } from "./Math";
import { decodeMathPlaceholder } from "../parser/math";

// Use Vencord's standard Parser from @webpack/common.
// Fallback: locate Discord's markdown parser via webpack props.
const MarkdownParser = Parser ?? findByPropsLazy("parse", "defaultRules");

/**
 * Render inline markdown content using Discord's own parser.
 * This preserves bold, italic, code, spoilers, emoji, mentions, etc.
 * Falls back to plain text if the parser isn't available.
 */
export function renderInline(text: string): React.ReactNode {
    if (!text) return null;

    // Handle placeholder patterns: {{FN:index:id}} and {{MATH:encoded}}
    const placeholderPattern = /\{\{(?:FN:\d+:[^}]+|MATH:[^}]+)\}\}/;
    if (placeholderPattern.test(text)) {
        // Split text around all placeholder markers and render each part
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        const regex = /\{\{(FN):(\d+):([^}]+)\}\}|\{\{(MATH):([^}]+)\}\}/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            // Text before the marker
            if (match.index > lastIndex) {
                const before = text.slice(lastIndex, match.index);
                parts.push(parseInline(before));
            }

            if (match[1] === "FN") {
                // Footnote ref component
                parts.push(
                    <FootnoteRef
                        key={`fn-${match[3]}-${match.index}`}
                        index={parseInt(match[2], 10)}
                        id={match[3]}
                    />
                );
            } else if (match[4] === "MATH") {
                // Inline math component
                const latex = decodeMathPlaceholder(match[5]);
                parts.push(
                    <MathInline
                        key={`math-${match.index}`}
                        latex={latex}
                    />
                );
            }

            lastIndex = match.index + match[0].length;
        }

        // Remaining text after last marker
        if (lastIndex < text.length) {
            parts.push(parseInline(text.slice(lastIndex)));
        }

        return <>{parts}</>;
    }

    return parseInline(text);
}

/**
 * Parse text with Discord's markdown parser.
 * Uses Vencord's standard Parser.parse(text, inline) API.
 * Falls back to plain text if the parser isn't available.
 */
function parseInline(text: string): React.ReactNode {
    if (!text) return null;

    try {
        if (MarkdownParser?.parse) {
            return MarkdownParser.parse(text, true);
        }
    } catch {
        // Parser failed — fall back to plain text
    }

    return text;
}
