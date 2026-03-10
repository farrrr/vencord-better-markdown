/*
 * Mermaid Diagram Component
 *
 * Renders mermaid diagram source as SVG.
 * Loads Mermaid asynchronously and shows loading/error states.
 * On error, falls back to displaying the raw mermaid code.
 */

import { useState, useEffect, useRef } from "@webpack/common";
import { renderDiagram } from "../mermaid-loader";

let idCounter = 0;

export function MermaidBlock({ code }: { code: string }) {
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const idRef = useRef(`bm-mermaid-${Date.now()}-${idCounter++}`);

    useEffect(() => {
        let cancelled = false;

        renderDiagram(idRef.current, code)
            .then(result => {
                if (cancelled) return;
                setSvg(result);
            })
            .catch(() => {
                if (cancelled) return;
                setError(true);
            });

        return () => { cancelled = true; };
    }, [code]);

    if (error) {
        return (
            <div className="bm-mermaid-wrapper bm-mermaid-error">
                <pre><code>{code}</code></pre>
            </div>
        );
    }

    if (svg === null) {
        return (
            <div className="bm-mermaid-wrapper bm-mermaid-loading">
                <span>Rendering diagram…</span>
            </div>
        );
    }

    return (
        <div
            className="bm-mermaid-wrapper"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
