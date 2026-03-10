/*
 * Heading Component
 *
 * Renders headings with proper visual hierarchy (h1–h6).
 * Uses semantic HTML elements for accessibility.
 */

import { type HeadingData } from "../parser/heading";
import { renderInline } from "./shared";

const HeadingTag = {
    1: "h1",
    2: "h2",
    3: "h3",
    4: "h4",
    5: "h5",
    6: "h6",
} as const;

export function Heading({ data }: { data: HeadingData }) {
    const Tag = HeadingTag[data.level] as keyof JSX.IntrinsicElements;

    return (
        <Tag className={`bm-heading bm-heading-${data.level}`}>
            {renderInline(data.text)}
        </Tag>
    );
}
