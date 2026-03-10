/*
 * Mermaid CDN Loader
 *
 * Dynamically loads Mermaid JS from jsdelivr CDN.
 * Caches the loaded module so subsequent calls are instant.
 * Lazy-loaded on first encounter (Mermaid is heavier than KaTeX).
 * Provides cleanup for plugin stop lifecycle.
 */

const MERMAID_VERSION = "11";
const CDN_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js`;

let mermaidModule: any = null;
let loadPromise: Promise<any> | null = null;
let initialized = false;

export async function loadMermaid(): Promise<any> {
    if (mermaidModule) return mermaidModule;
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = CDN_URL;
        script.onload = () => {
            mermaidModule = (window as any).mermaid;
            if (!initialized && mermaidModule) {
                mermaidModule.initialize({
                    startOnLoad: false,
                    theme: "dark",
                    securityLevel: "strict",
                    suppressErrorRendering: true,
                });
                initialized = true;
            }
            resolve(mermaidModule);
        };
        script.onerror = () => reject(new Error("Failed to load Mermaid"));
        document.head.appendChild(script);
    });

    return loadPromise;
}

export function isMermaidLoaded(): boolean {
    return mermaidModule != null;
}

export async function renderDiagram(id: string, code: string): Promise<string> {
    const mermaid = await loadMermaid();
    const { svg } = await mermaid.render(id, code);
    return svg;
}

export function cleanup(): void {
    const scripts = document.querySelectorAll(`script[src*="mermaid"]`);
    scripts.forEach(s => s.remove());
    mermaidModule = null;
    loadPromise = null;
    initialized = false;
    delete (window as any).mermaid;
}
