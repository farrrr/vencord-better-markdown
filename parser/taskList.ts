/*
 * Task List Parser
 *
 * Parses GitHub-style task lists: `- [x] Done` and `- [ ] Todo`.
 * Supports -, *, + as list markers. Checkboxes are read-only.
 */

export interface TaskItem {
    checked: boolean;
    text: string;
}

export interface TaskListData {
    items: TaskItem[];
}

// Match both standard markdown list markers (-*+) and Discord's
// normalized bullet (•) which appears when Discord processes messages.
const TASK_PATTERN = /^[\s]*[-*+•]\s+\[([ xX])\]\s+(.+)$/;

export function detectTaskList(text: string): boolean {
    return /[-*+•]\s+\[[ xX]\]\s/.test(text);
}

/**
 * Check if a single line is a task list item.
 */
export function isTaskLine(line: string): boolean {
    return TASK_PATTERN.test(line);
}

/**
 * Parse a single task list line.
 */
export function parseTaskLine(line: string): TaskItem | null {
    const match = line.match(TASK_PATTERN);
    if (!match) return null;
    return {
        checked: match[1].toLowerCase() === "x",
        text: match[2],
    };
}

/**
 * Extract consecutive task list items from lines.
 * Returns blocks of consecutive task items with their line indices.
 */
export function extractTaskLists(lines: string[]): { start: number; end: number; data: TaskListData }[] {
    const lists: { start: number; end: number; data: TaskListData }[] = [];
    let i = 0;

    while (i < lines.length) {
        if (isTaskLine(lines[i])) {
            const start = i;
            const items: TaskItem[] = [];

            while (i < lines.length && isTaskLine(lines[i])) {
                const item = parseTaskLine(lines[i]);
                if (item) items.push(item);
                i++;
            }

            if (items.length > 0) {
                lists.push({ start, end: i, data: { items } });
            }
        } else {
            i++;
        }
    }

    return lists;
}
