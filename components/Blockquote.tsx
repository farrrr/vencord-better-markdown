/*
 * Nested Blockquote Component
 *
 * Renders blockquotes with visual nesting: cascading left borders
 * with depth-varying colors. Each nesting level gets a distinct
 * border color and slight indentation.
 */

import { type BlockquoteNode, type BlockquoteData } from "../parser/blockquote";
import { renderInline } from "./shared";

// Colors cycle through these for nested levels
const DEPTH_COLORS = [
    "var(--text-muted)",           // depth 1: default Discord quote color
    "var(--brand-500, #5865f2)",   // depth 2: blurple
    "var(--green-360, #2dc770)",   // depth 3: green
    "var(--yellow-300, #faa61a)",  // depth 4: yellow
    "var(--red-400, #ed4245)",     // depth 5: red
    "var(--brand-360, #7289da)",   // depth 6+: light blurple
];

function getDepthColor(depth: number): string {
    return DEPTH_COLORS[(depth - 1) % DEPTH_COLORS.length];
}

function QuoteNode({ node }: { node: BlockquoteNode }) {
    return (
        <blockquote
            className={`bm-blockquote bm-blockquote-depth-${Math.min(node.depth, 6)}`}
            style={{
                borderLeftColor: getDepthColor(node.depth),
            }}
        >
            {node.lines.length > 0 && (
                <div className="bm-blockquote-content">
                    {node.lines.map((line, i) => (
                        <div key={i}>{renderInline(line) || "\u00A0"}</div>
                    ))}
                </div>
            )}
            {node.children.map((child, i) => (
                <QuoteNode key={i} node={child} />
            ))}
        </blockquote>
    );
}

export function Blockquote({ data }: { data: BlockquoteData }) {
    return (
        <div className="bm-blockquote-wrapper">
            {data.root.children.map((child, i) => (
                <QuoteNode key={i} node={child} />
            ))}
            {data.root.lines.length > 0 && (
                <div className="bm-blockquote-root-text">
                    {data.root.lines.map((line, i) => (
                        <div key={i}>{renderInline(line)}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
