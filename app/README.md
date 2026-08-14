# README

## About

This is the official Wails React-TS template.

You can configure the project by editing `wails.json`. More information about the project settings can be found
here: https://wails.io/docs/reference/project-config

## Live Development

To run in live development mode, run `wails dev` in the project directory. This will run a Vite development
server that will provide very fast hot reload of your frontend changes. If you want to develop in a browser
and have access to your Go methods, there is also a dev server that runs on http://localhost:34115. Connect
to this in your browser, and you can call your Go code from devtools.

## Building

To build a redistributable, production mode package, use `wails build`.

## Backend (Go) Bindings

The Go backend (`app.go`, `watcher.go`) exposes file access services to the
frontend through Wails bindings. Generated bindings live in
`frontend/wailsjs/go/main/` (`App.js` / `App.d.ts`, do not edit — run
`wails generate module` to regenerate).

### Method signatures (frontend calls these as Promises)

| Frontend call | Go signature | Description |
| --- | --- | --- |
| `OpenFileDialog(): Promise<string>` | `func (a *App) OpenFileDialog() (string, error)` | Native open dialog (title "打开 Markdown 文件", filter `*.md;*.markdown;*.txt;*.mdown`). Returns the selected absolute path, or `""` when cancelled. |
| `ReadFile(path: string): Promise<main.ReadResult>` | `func (a *App) ReadFile(path string) (*ReadResult, error)` | Reads a file (≤ 64 MiB) and decodes it to UTF-8. `ReadResult = { Content: string, Encoding: "utf-8" \| "gbk" \| "utf-16le" \| "utf-16be" \| "unknown" }`. `Encoding === "unknown"` means raw bytes were returned as-is. |
| `GetFileInfo(path: string): Promise<main.FileInfo>` | `func (a *App) GetFileInfo(path string) (*FileInfo, error)` | `FileInfo = { Name: string, Size: number, ModTime: string }` — `ModTime` is RFC3339 (local time), for the status bar. |
| `WatchFile(path: string): Promise<void>` | `func (a *App) WatchFile(path string) error` | Starts watching the file's directory for changes; **any previous watcher is stopped first** (call it again when switching files). |
| `StopWatch(): Promise<void>` | `func (a *App) StopWatch()` | Stops the current watcher. |

### File-change events

`WatchFile` emits Wails runtime events (subscribe with `EventsOn`):

```
event: "file:changed"
data:  { path: string, op: "write" | "remove" | "rename" }
```

Events are coalesced over a 300 ms window (one emit per burst; the last op
wins, so an atomic save that removes and recreates the file reports
`"write"`). On `"remove"`/`"rename"` the frontend should show a
"file deleted/moved" notice and stop re-reading until the user reopens.

### Typical frontend flow

1. `const path = await OpenFileDialog()` → if empty, user cancelled.
2. `const res = await ReadFile(path)` → render `res.Content` (show a notice
   if `res.Encoding === "unknown"`).
3. `const info = await GetFileInfo(path)` → status bar.
4. `await WatchFile(path)` → subscribe to `file:changed`; on `op === "write"`
   call `ReadFile(path)` again to refresh the preview.

### Notes / tradeoffs

- `ReadFile` returns a small struct rather than a bare string so the
  frontend knows which encoding conversion was applied (the "mark" required
  for undecodable files). The file content itself is read into memory only
  once — `Content` is the single decoded string.
- Files > 64 MiB are rejected with a friendly error before reading.
- The watcher listens to the file's **directory** (fsnotify requirement on
  Windows) and filters events by the watched file name (case-insensitive).
- New backend dependencies: `github.com/fsnotify/fsnotify` (file watching),
  `golang.org/x/text` (GBK/encoding conversion). `go 1.25` is required
  (wails v2.14 constraint).
