/*
 * GFM Table Component
 *
 * Renders parsed table data with proper alignment, header styling,
 * and alternating row colors. Inline markdown is rendered via
 * Discord's parser through the renderInline helper.
 */

import { type TableData } from "../parser/table";
import { renderInline } from "./shared";

export function Table({ data }: { data: TableData }) {
    return (
        <div className="bm-table-wrapper">
            <table className="bm-table">
                <thead>
                    <tr>
                        {data.headers.map((header, i) => (
                            <th
                                key={i}
                                className="bm-table-th"
                                style={{ textAlign: header.align === "none" ? undefined : header.align }}
                            >
                                {renderInline(header.text)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className={rowIdx % 2 === 1 ? "bm-table-row-alt" : undefined}>
                            {row.map((cell, cellIdx) => (
                                <td
                                    key={cellIdx}
                                    className="bm-table-td"
                                    style={{
                                        textAlign:
                                            data.headers[cellIdx]?.align === "none"
                                                ? undefined
                                                : data.headers[cellIdx]?.align,
                                    }}
                                >
                                    {renderInline(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
