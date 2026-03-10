# BetterMarkdown

A Vencord userplugin that enhances Discord's markdown rendering with full GitHub Flavored Markdown (GFM) support.

## Features

| Feature | Syntax | Description |
|---|---|---|
| **GFM Tables** | `\| h1 \| h2 \|` | Full table rendering with column alignment |
| **Task Lists** | `- [x] Done` | Read-only checkboxes for todo items |
| **Headings** | `# H1` – `###### H6` | Proper visual hierarchy (Discord renders all as bold) |
| **Horizontal Rules** | `---`, `***`, `___` | Styled divider lines |
| **Footnotes** | `[^1]` + `[^1]: text` | Superscript references with definitions section |
| **Nested Blockquotes** | `> > > text` | Visual nesting with depth-colored borders |

## How It Works

BetterMarkdown uses **post-render interception**:

1. Intercepts the message content render pipeline via Vencord patches
2. Performs a fast check for GFM patterns in the raw message text
3. If patterns found → parses and renders with custom React components
4. If no patterns → falls through to Discord's default renderer (**zero overhead**)

Discord's existing markdown (bold, italic, code, spoilers, etc.) is preserved — inline formatting within enhanced blocks uses Discord's own parser.

## Installation

Copy the `betterMarkdown` folder into your Vencord `src/userplugins/` directory:

```
src/userplugins/
└── betterMarkdown/
    ├── index.tsx
    ├── parser/
    │   ├── index.ts
    │   ├── table.ts
    │   ├── taskList.ts
    │   ├── heading.ts
    │   ├── hr.ts
    │   ├── footnote.ts
    │   └── blockquote.ts
    ├── components/
    │   ├── Table.tsx
    │   ├── TaskList.tsx
    │   ├── Heading.tsx
    │   ├── Hr.tsx
    │   ├── Footnote.tsx
    │   ├── Blockquote.tsx
    │   └── shared.tsx
    ├── style.css
    └── README.md
```

Then rebuild Vencord (`pnpm build` or restart with `pnpm watch`).

## Settings

All features can be individually toggled in Vencord Settings → Plugins → BetterMarkdown:

- **Enable Tables** — GFM table rendering (default: on)
- **Enable Task Lists** — Checkbox rendering (default: on)
- **Enable Headings** — H1–H6 hierarchy (default: on)
- **Enable Horizontal Rules** — Styled `<hr>` (default: on)
- **Enable Footnotes** — Reference/definition footnotes (default: on)
- **Enable Nested Blockquotes** — Visual depth for `> >` (default: on)
- **Theme** — Discord Dark (default), Discord Light, or GitHub

## Syntax Examples

### Tables

```
| Name | Role | Status |
|:-----|:----:|-------:|
| Alice | Dev | Active |
| Bob | PM | Away |
```

Alignment: `:---` left, `:---:` center, `---:` right.

### Task Lists

```
- [x] Write parser
- [x] Build components
- [ ] Test in Discord
- [ ] Ship it
```

### Headings

```
# Main Title
## Section
### Subsection
#### Detail
##### Minor
###### Footnote-level
```

### Footnotes

```
This claim needs a source[^1] and this one too[^note].

[^1]: Source: Journal of Computer Science, 2024
[^note]: Additional context for the claim
```

### Nested Blockquotes

```
> Top level quote
> > Nested response
> > > Even deeper
> > Back to level 2
> Back to level 1
```

## Technical Notes

### Patch Verification

The primary patch targets `#{intl::MESSAGE_EDITED}` to find the message content component. If Discord updates break this finder, try these alternatives (edit `index.tsx`):

1. `".messageContent,"`
2. `"renderMessageMarkupToAST"`
3. `"defaultRules"`
4. `".content,className:"`

### Performance

- **Detection is O(n)** on message length — simple regex tests
- **Parsing only runs** when GFM patterns are detected
- **No external dependencies** — all parsers are hand-written and lightweight
- Messages without GFM syntax have zero performance impact

### Graceful Degradation

- If the patch breaks, Discord renders normally (try/catch wraps all interception)
- If a parser fails, the original content is preserved
- If Discord's inline parser is unavailable, text renders as plain

### Limitations

- Enhanced rendering is client-side only — other users see the raw markdown
- Code blocks (`` ``` ``) are protected from parsing
- Tables require the separator row (`|---|---|`) to be recognized
- Footnote IDs are case-sensitive

## Architecture

```
Message Text
    │
    ▼
┌──────────────────┐
│  hasGfmPatterns() │──── false ──→ Discord default render
│  (fast detection) │
└──────┬───────────┘
       │ true
       ▼
┌──────────────────┐
│  parseMessage()   │
│  ├─ table.ts      │
│  ├─ taskList.ts   │
│  ├─ heading.ts    │
│  ├─ hr.ts         │
│  ├─ footnote.ts   │
│  └─ blockquote.ts │
└──────┬───────────┘
       │ ParsedBlock[]
       ▼
┌──────────────────┐
│  React Components │
│  ├─ Table.tsx     │
│  ├─ TaskList.tsx  │
│  ├─ Heading.tsx   │
│  ├─ Hr.tsx        │
│  ├─ Footnote.tsx  │
│  └─ Blockquote.tsx│
└──────┬───────────┘
       │ React.ReactNode
       ▼
  Enhanced Message
```

## License

MIT
