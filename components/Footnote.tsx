/*
 * Footnote Component
 *
 * Two parts:
 * 1. FootnoteRef — superscript number rendered inline
 * 2. FootnoteSection — definitions rendered at the bottom of the message
 */

import { type FootnoteData } from "../parser/footnote";
import { renderInline } from "./shared";

/**
 * Inline footnote reference — renders as superscript number.
 * Used within text blocks when {{FN:index:id}} placeholders are found.
 */
export function FootnoteRef({ index, id }: { index: number; id: string }) {
    return (
        <sup className="bm-footnote-ref">
            <a
                href={`#bm-fn-def-${id}`}
                id={`bm-fn-ref-${id}`}
                className="bm-footnote-link"
                title={`Footnote ${index}`}
                onClick={e => {
                    e.preventDefault();
                    const target = document.getElementById(`bm-fn-def-${id}`);
                    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
            >
                [{index}]
            </a>
        </sup>
    );
}

/**
 * Footnote definitions section — rendered at the bottom of the message.
 */
export function FootnoteSection({ data }: { data: FootnoteData }) {
    return (
        <div className="bm-footnote-section">
            <hr className="bm-footnote-divider" />
            <ol className="bm-footnote-list">
                {data.definitions.map(def => (
                    <li
                        key={def.id}
                        id={`bm-fn-def-${def.id}`}
                        className="bm-footnote-item"
                        value={def.index}
                    >
                        <span className="bm-footnote-content">
                            {renderInline(def.text)}
                        </span>
                        <a
                            href={`#bm-fn-ref-${def.id}`}
                            className="bm-footnote-backref"
                            title="Back to reference"
                            onClick={e => {
                                e.preventDefault();
                                const target = document.getElementById(`bm-fn-ref-${def.id}`);
                                target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                            }}
                        >
                            ↩
                        </a>
                    </li>
                ))}
            </ol>
        </div>
    );
}
