/*
 * BetterMarkdown — Vencord Userplugin
 *
 * Enhances Discord's markdown rendering with full GFM support:
 * tables, task lists, proper headings, horizontal rules,
 * footnotes, nested blockquotes, KaTeX math, and Mermaid diagrams.
 *
 * Architecture: MessageAccessory-based rendering.
 * Uses Vencord's renderMessageAccessory API to detect GFM patterns
 * in message content and render enhanced components as accessories.
 * Original message content is hidden via DOM manipulation when
 * enhanced content is displayed.
 *
 * This approach requires no webpack patches, making it resilient
 * to Discord client updates.
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

/**
 * React component that renders enhanced markdown as a message accessory.
 * Hides the original message content via DOM manipulation when mounted,
 * and restores it on unmount.
 */
function EnhancedMarkdownAccessory({ message }: { message: any; }) {
    const { useRef, useEffect, useState } = Vencord.Webpack.Common.React;
    const ref = useRef<HTMLDivElement>(null);
    const hiddenRef = useRef<HTMLElement | null>(null);
    const [, forceUpdate] = useState(0);

    const content = message?.content;
    const flags = getFeatureFlags();

    // Check if this message should be enhanced
    if (!content || typeof content !== "string" || !hasGfmPatterns(content, flags)) {
        return null;
    }

    let blocks: ParsedBlock[];
    try {
        blocks = parseMessage(content, flags);
    } catch (e) {
        console.error("[BetterMarkdown] Parse error:", e);
        return null;
    }

    // If parsing produced only plain text with no enhanced placeholders, don't enhance.
    // Text blocks may contain {{MATH:...}} or {{FN:...}} placeholders that need rendering.
    if (blocks.length === 1 && blocks[0].type === "text") {
        const content = blocks[0].content;
        if (!content.includes("{{MATH:") && !content.includes("{{FN:")) {
            return null;
        }
    }

    const themeClass = getThemeClass();

    // Hide original message content and restore on unmount
    useEffect(() => {
        if (!ref.current) return;

        // Strategy: walk up from our accessory to the message container,
        // then find and hide the original message content element.
        //
        // Discord DOM structure (simplified):
        //   <div role="article" ...>        ← message wrapper
        //     <div class="contents_...">
        //       <div id="message-content-XXX" class="markup_... messageContent_...">
        //         original text here
        //       </div>
        //     </div>
        //     <div id="message-accessories-XXX" class="container_...">
        //       <div class="bm-enhanced-content">  ← our component (ref)
        //     </div>
        //   </div>

        // Walk up to find the article (message wrapper)
        let el: HTMLElement | null = ref.current;
        while (el && el.getAttribute("role") !== "article") {
            el = el.parentElement;
        }
        if (!el) return;

        const messageWrapper = el;

        // Find the content element by id pattern or class
        const contentEl = (
            messageWrapper.querySelector("[id^='message-content-']") ||
            messageWrapper.querySelector("[class*='messageContent']") ||
            messageWrapper.querySelector("[class*='markup_'][class*='messageContent']")
        ) as HTMLElement | null;

        if (contentEl && !contentEl.dataset.bmHidden) {
            contentEl.dataset.bmHidden = "true";
            contentEl.style.display = "none";
            hiddenRef.current = contentEl;
        }

        return () => {
            if (hiddenRef.current) {
                hiddenRef.current.style.display = "";
                delete hiddenRef.current.dataset.bmHidden;
                hiddenRef.current = null;
            }
        };
    }, [content]);

    return (
        <div ref={ref} className={`bm-enhanced-content ${themeClass}`.trim()} data-bm-message-id={message.id}>
            {blocks.map((block, i) => renderBlock(block, i))}
        </div>
    );
}

export default definePlugin({
    name: "BetterMarkdown",
    description: "Enhanced markdown: GFM tables, task lists, headings, HR, footnotes, blockquotes, KaTeX math, Mermaid diagrams",
    authors: [{ name: "Rei", id: 0n }],
    settings,

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

    // No patches needed — we use the MessageAccessory API instead.
    // This makes the plugin resilient to Discord client updates.

    renderMessageAccessory(props: { message: any; }) {
        return <EnhancedMarkdownAccessory message={props.message} />;
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
