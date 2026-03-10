/*
 * BetterMarkdown — Vencord Userplugin
 *
 * Enhances Discord's markdown rendering with full GFM support:
 * tables, task lists, proper headings, horizontal rules,
 * footnotes, and nested blockquotes.
 *
 * Architecture: post-render interception. We patch the message
 * content render path, check for GFM patterns in the raw text,
 * and replace with our enhanced React components when found.
 * Messages without GFM patterns pass through untouched (zero overhead).
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

import { parseMessage, hasGfmPatterns, type ParsedBlock, type FeatureFlags } from "./parser";
import { Table } from "./components/Table";
import { TaskList } from "./components/TaskList";
import { Heading } from "./components/Heading";
import { Hr } from "./components/Hr";
import { FootnoteSection } from "./components/Footnote";
import { Blockquote } from "./components/Blockquote";
import { MathBlock } from "./components/Math";
import { loadKaTeX, cleanup as cleanupKaTeX } from "./katex-loader";

import "./style.css";

// Discord's markdown parser — used for rendering inline content in text blocks
// @ts-ignore
const MarkdownParser = findByPropsLazy("parse", "defaultRules");

const settings = definePluginSettings({
    enableTables: {
        type: OptionType.BOOLEAN,
        description: "Render GFM tables",
        default: true,
        restartNeeded: false,
    },
    enableTaskLists: {
        type: OptionType.BOOLEAN,
        description: "Render task list checkboxes",
        default: true,
        restartNeeded: false,
    },
    enableHeadings: {
        type: OptionType.BOOLEAN,
        description: "Render heading hierarchy (h1–h6 with proper sizing)",
        default: true,
        restartNeeded: false,
    },
    enableHorizontalRules: {
        type: OptionType.BOOLEAN,
        description: "Render horizontal rules (---, ***, ___)",
        default: true,
        restartNeeded: false,
    },
    enableFootnotes: {
        type: OptionType.BOOLEAN,
        description: "Render footnotes with references and definitions",
        default: true,
        restartNeeded: false,
    },
    enableNestedBlockquotes: {
        type: OptionType.BOOLEAN,
        description: "Better nested blockquotes with visual depth",
        default: true,
        restartNeeded: false,
    },
    enableMath: {
        type: OptionType.BOOLEAN,
        description: "Render LaTeX math formulas via KaTeX ($...$ inline, $$...$$ block)",
        default: true,
        restartNeeded: false,
    },
    theme: {
        type: OptionType.SELECT,
        description: "Visual theme for enhanced elements",
        options: [
            { label: "Discord Dark", value: "dark", default: true },
            { label: "Discord Light", value: "light" },
            { label: "GitHub", value: "github" },
        ],
        restartNeeded: false,
    },
});

function getFeatureFlags(): FeatureFlags {
    return {
        enableTables: settings.store.enableTables,
        enableTaskLists: settings.store.enableTaskLists,
        enableHeadings: settings.store.enableHeadings,
        enableHorizontalRules: settings.store.enableHorizontalRules,
        enableFootnotes: settings.store.enableFootnotes,
        enableNestedBlockquotes: settings.store.enableNestedBlockquotes,
        enableMath: settings.store.enableMath,
    };
}

function getThemeClass(): string {
    const theme = settings.store.theme;
    if (theme === "github") return "bm-theme-github";
    if (theme === "light") return "bm-theme-light";
    return "";
}

/**
 * Render a single parsed block as a React component.
 */
function renderBlock(block: ParsedBlock, key: number): React.ReactNode {
    switch (block.type) {
        case "table":
            return <Table key={key} data={block.content} />;
        case "taskList":
            return <TaskList key={key} data={block.content} />;
        case "heading":
            return <Heading key={key} data={block.content} />;
        case "hr":
            return <Hr key={key} />;
        case "footnoteSection":
            return <FootnoteSection key={key} data={block.content} />;
        case "blockquote":
            return <Blockquote key={key} data={block.content} />;
        case "mathBlock":
            return <MathBlock key={key} latex={block.content.latex} />;
        case "text":
            return renderTextBlock(block.content, key);
        default:
            return null;
    }
}

/**
 * Render a text block using Discord's markdown parser for inline formatting.
 * This preserves bold, italic, code, spoilers, emoji, mentions, etc.
 */
function renderTextBlock(text: string, key: number): React.ReactNode {
    try {
        if (MarkdownParser?.parse) {
            const parsed = MarkdownParser.parse(text);
            if (Array.isArray(parsed)) {
                return <span key={key} className="bm-text-block">{parsed}</span>;
            }
            return <span key={key} className="bm-text-block">{parsed}</span>;
        }
    } catch {
        // Parser not available or failed
    }

    // Fallback: plain text with line breaks
    return (
        <span key={key} className="bm-text-block">
            {text.split("\n").map((line, i, arr) => (
                <span key={i}>
                    {line}
                    {i < arr.length - 1 && <br />}
                </span>
            ))}
        </span>
    );
}

export default definePlugin({
    name: "BetterMarkdown",
    description: "Enhanced GFM markdown: tables, task lists, headings, horizontal rules, footnotes, and nested blockquotes",
    authors: [{ name: "BetterMarkdown", id: 0n }],
    settings,

    start() {
        // Preload KaTeX so it's ready when math content appears
        if (settings.store.enableMath) {
            loadKaTeX().catch(() => {
                // Silently fail — KaTeX will retry on first render
            });
        }
    },

    stop() {
        cleanupKaTeX();
    },

    patches: [
        {
            // Intercept message content rendering.
            //
            // This targets the MessageContent component where message markup
            // is parsed and rendered. The finder locates the module containing
            // the message content render logic.
            //
            // TODO: verify finder with running Discord instance.
            // If this finder doesn't work, try these alternatives in order:
            //   1. "#{intl::MESSAGE_EDITED}"
            //   2. ".messageContent,"
            //   3. "renderMessageMarkupToAST"
            //   4. "defaultRules"
            //   5. ".content,className:"
            //
            find: "#{intl::MESSAGE_EDITED}",
            replacement: {
                // Match where message content children are assembled.
                // This captures the message object and the rendered children,
                // allowing us to intercept and enhance when GFM patterns are present.
                //
                // Pattern: looks for where `message` (a minified var) has its
                // `.content` accessed and rendered into children.
                // \i is Vencord's "any identifier" matcher.
                match: /let\{className:\i,message:(\i),.*?children:(\i)(?=.*?#{intl::MESSAGE_EDITED})/,
                replace: "let{className:$self._cn,message:$1,...$self._rest}=arguments[0];children:$self.processContent($2,$1)"
            }
        },
        {
            // Secondary patch: intercept the simpler markdown render path
            // used for message previews and some content types.
            //
            // TODO: verify finder — this is a fallback if the primary patch
            // doesn't catch all message content rendering.
            find: "defaultRules",
            predicate: () => false, // Disabled by default — enable if needed
            replacement: {
                match: /parse\((\i)\.content/,
                replace: "$self.maybeEnhance($1)||parse($1.content"
            }
        },
    ],

    /**
     * Core interception: checks if the message contains GFM patterns
     * and returns enhanced React content if so.
     */
    processContent(originalChildren: React.ReactNode, message: any): React.ReactNode {
        try {
            if (!message?.content || typeof message.content !== "string") {
                return originalChildren;
            }

            const flags = getFeatureFlags();
            if (!hasGfmPatterns(message.content, flags)) {
                return originalChildren;
            }

            const blocks = parseMessage(message.content, flags);

            // If parsing produced only a single text block, no enhancement needed
            if (blocks.length === 1 && blocks[0].type === "text") {
                return originalChildren;
            }

            const themeClass = getThemeClass();

            return (
                <div className={`bm-enhanced-content ${themeClass}`.trim()}>
                    {blocks.map((block, i) => renderBlock(block, i))}
                </div>
            );
        } catch (e) {
            // Graceful degradation: if anything fails, return original content
            console.error("[BetterMarkdown] Error enhancing content:", e);
            return originalChildren;
        }
    },

    /**
     * Alternative interception for the secondary patch.
     * Returns enhanced JSX if GFM patterns found, or undefined to fall through.
     */
    maybeEnhance(message: any): React.ReactNode | undefined {
        try {
            if (!message?.content || typeof message.content !== "string") {
                return undefined;
            }

            const flags = getFeatureFlags();
            if (!hasGfmPatterns(message.content, flags)) {
                return undefined;
            }

            const blocks = parseMessage(message.content, flags);
            if (blocks.length === 1 && blocks[0].type === "text") {
                return undefined;
            }

            const themeClass = getThemeClass();

            return (
                <div className={`bm-enhanced-content ${themeClass}`.trim()}>
                    {blocks.map((block, i) => renderBlock(block, i))}
                </div>
            );
        } catch {
            return undefined;
        }
    },

    /**
     * Check if a message should have enhanced rendering.
     * Exported for potential use by other plugins.
     */
    shouldEnhance(content: string): boolean {
        if (!content || typeof content !== "string") return false;
        return hasGfmPatterns(content, getFeatureFlags());
    },
});
