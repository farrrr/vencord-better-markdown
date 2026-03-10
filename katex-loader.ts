/*
 * KaTeX CDN Loader
 *
 * Dynamically loads KaTeX JS + CSS from jsdelivr CDN.
 * Caches the loaded module so subsequent calls are instant.
 * Provides cleanup for plugin stop lifecycle.
 */

const KATEX_VERSION = "0.16.21";
const CDN_BASE = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;

let katexModule: any = null;
let loadPromise: Promise<any> | null = null;
let cssLoaded = false;

function loadCSS(): void {
    if (cssLoaded) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${CDN_BASE}/katex.min.css`;
    document.head.appendChild(link);
    cssLoaded = true;
}

export async function loadKaTeX(): Promise<any> {
    if (katexModule) return katexModule;
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        loadCSS();
        const script = document.createElement("script");
        script.src = `${CDN_BASE}/katex.min.js`;
        script.onload = () => {
            katexModule = (window as any).katex;
            resolve(katexModule);
        };
        script.onerror = () => reject(new Error("Failed to load KaTeX"));
        document.head.appendChild(script);
    });

    return loadPromise;
}

export function isKaTeXLoaded(): boolean {
    return katexModule != null;
}

export function renderToString(latex: string, displayMode: boolean): string {
    if (!katexModule) return latex;
    try {
        return katexModule.renderToString(latex, {
            displayMode,
            throwOnError: false,
            errorColor: "#ed4245",
        });
    } catch {
        return latex;
    }
}

export function cleanup(): void {
    // Remove injected CSS link
    const links = document.querySelectorAll(`link[href*="katex"]`);
    links.forEach(l => l.remove());
    // Remove injected script
    const scripts = document.querySelectorAll(`script[src*="katex"]`);
    scripts.forEach(s => s.remove());
    // Clear cached module
    katexModule = null;
    loadPromise = null;
    cssLoaded = false;
    delete (window as any).katex;
}
