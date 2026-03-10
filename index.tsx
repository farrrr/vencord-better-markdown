/*
 * BetterMarkdown — Vencord Userplugin
 *
 * Enhances Discord's markdown rendering with full GFM support:
 * tables, task lists, proper headings, horizontal rules,
 * footnotes, nested blockquotes, KaTeX math, and Mermaid diagrams.
 *
 * Architecture: MessageAccessory + CSS content hiding.
 * Uses Vencord's renderMessageAccessory API to render enhanced
 * components. Original message content is hidden via CSS :has()
 * selector — no raw DOM manipulation or webpack patches needed.
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

import { parseMessage, hasGfmPatterns, type ParsedBlock, type FeatureFlags } from "./parser";
import { Table } from "./components/Table";
import { TaskList } from "./components/TaskList";
import { Heading } from "./components/Heading";
import { Hr } from "./components/Hr";
import { FootnoteSection } from "./components/Footnote";
import { Blockquote } from "./components/Blockquote";
import { MathBlock } from "./components/Math";
import { MermaidBlock } from "./components/Mermaid";
import { renderInline } from "./components/shared";
import { loadKaTeX, cleanup as cleanupKaTeX } from "./katex-loader";
import { cleanup as cleanupMermaid } from "./mermaid-loader";

import "./style.css";

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
    enableMermaid: {
        type: OptionType.BOOLEAN,
        description: "Render Mermaid diagrams from ```mermaid code blocks",
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
        enableMermaid: settings.store.enableMermaid,
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
        case "mermaidBlock":
            return <MermaidBlock key={key} code={block.content.code} />;
        case "text":
            return renderTextBlock(block.content, key);
        default:
            return null;
    }
}

/**
 * Render a text block using Discord's markdown parser for inline formatting.
 * Handles {{MATH:...}} and {{FN:...}} placeholders via shared.tsx's renderInline().
 * Preserves bold, italic, code, spoilers, emoji, mentions, etc.
 */
function renderTextBlock(text: string, key: number): React.ReactNode {
    return (
        <span key={key} className="bm-text-block">
            {text.split("\n").map((line, i, arr) => (
                <span key={i}>
                    {renderInline(line)}
                    {i < arr.length - 1 && <br />}
                </span>
            ))}
        </span>
    );
}

export default definePlugin({
    name: "BetterMarkdown",
    description: "Enhanced markdown: GFM tables, task lists, headings, HR, footnotes, blockquotes, KaTeX math, Mermaid diagrams",
    authors: [{ name: "Rei", id: 0n }],
    settings,

    // No patches needed — we use renderMessageAccessory (Vencord API) to add
    // enhanced content, and CSS :has() to hide the original message content.
    // This avoids both raw DOM manipulation and fragile webpack patches.

    start() {
        if (settings.store.enableMath) {
            loadKaTeX().catch(() => {
                // Silently fail — KaTeX will retry on first render
            });
        }
    },

    stop() {
        cleanupKaTeX();
        cleanupMermaid();
    },

    /**
     * Render enhanced markdown as a message accessory.
     * Original content is hidden via CSS :has() — see style.css.
     */
    renderMessageAccessory(props: { message: any; }) {
        try {
            const content = props.message?.content;
            if (!content || typeof content !== "string") return null;

            const flags = getFeatureFlags();
            if (!hasGfmPatterns(content, flags)) return null;

            const blocks = parseMessage(content, flags);

            // If parsing produced only plain text with no enhanced placeholders,
            // no enhancement needed.
            if (blocks.length === 1 && blocks[0].type === "text") {
                const text = blocks[0].content;
                if (!text.includes("{{MATH:") && !text.includes("{{FN:")) {
                    return null;
                }
            }

            const themeClass = getThemeClass();

            return (
                <div className={`bm-enhanced-content ${themeClass}`.trim()} data-bm-message-id={props.message.id}>
                    {blocks.map((block, i) => renderBlock(block, i))}
                </div>
            );
        } catch (e) {
            console.error("[BetterMarkdown] Error enhancing content:", e);
            return null;
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
