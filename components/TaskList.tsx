/*
 * Task List Component
 *
 * Renders task list items as read-only checkboxes.
 * Styled to match Discord's visual language.
 */

import { type TaskListData } from "../parser/taskList";
import { renderInline } from "./shared";

export function TaskList({ data }: { data: TaskListData }) {
    return (
        <ul className="bm-task-list">
            {data.items.map((item, i) => (
                <li key={i} className="bm-task-item">
                    <input
                        type="checkbox"
                        checked={item.checked}
                        disabled
                        className="bm-task-checkbox"
                        aria-label={item.checked ? "Completed" : "Not completed"}
                    />
                    <span className={`bm-task-text ${item.checked ? "bm-task-done" : ""}`}>
                        {renderInline(item.text)}
                    </span>
                </li>
            ))}
        </ul>
    );
}
