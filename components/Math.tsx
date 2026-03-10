/*
 * Math Components (KaTeX)
 *
 * Two components:
 * - MathBlock: display mode, centered, for $$...$$ blocks
 * - MathInline: inline mode, for $...$ expressions
 *
 * Both load KaTeX asynchronously and show a placeholder while loading.
 * KaTeX output is safe HTML, rendered via dangerouslySetInnerHTML.
 */

import { useState, useEffect } from "@webpack/common";
import { loadKaTeX, isKaTeXLoaded, renderToString } from "../katex-loader";

/**
 * Display-mode math block — centered, for $$...$$ expressions.
 */
export function MathBlock({ latex }: { latex: string }) {
    const [html, setHtml] = useState<string | null>(
        isKaTeXLoaded() ? renderToString(latex, true) : null
    );
    const [error, setError] = useState(false);

    useEffect(() => {
        if (html !== null) return;
        let cancelled = false;

        loadKaTeX()
            .then(() => {
                if (cancelled) return;
                const rendered = renderToString(latex, true);
                setHtml(rendered);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
            });

        return () => { cancelled = true; };
    }, [latex]);

    if (error) {
        return (
            <div className="bm-math-block bm-math-error">
                {"$$"}{latex}{"$$"}
            </div>
        );
    }

    if (html === null) {
        return (
            <div className="bm-math-block bm-math-loading">
                <span className="bm-math-raw">{"$$"}{latex}{"$$"}</span>
            </div>
        );
    }

    return (
        <div
            className="bm-math-block"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

/**
 * Inline math — for $...$ expressions within text.
 */
export function MathInline({ latex }: { latex: string }) {
    const [html, setHtml] = useState<string | null>(
        isKaTeXLoaded() ? renderToString(latex, false) : null
    );
    const [error, setError] = useState(false);

    useEffect(() => {
        if (html !== null) return;
        let cancelled = false;

        loadKaTeX()
            .then(() => {
                if (cancelled) return;
                const rendered = renderToString(latex, false);
                setHtml(rendered);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
            });

        return () => { cancelled = true; };
    }, [latex]);

    if (error) {
        return <span className="bm-math-inline bm-math-error">{"$"}{latex}{"$"}</span>;
    }

    if (html === null) {
        return <span className="bm-math-inline bm-math-raw">{"$"}{latex}{"$"}</span>;
    }

    return (
        <span
            className="bm-math-inline"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
