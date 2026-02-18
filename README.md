# DevDebug Studio

DevDebug Studio is a browser-based JavaScript step debugger that lets you run code, step through execution, set breakpoints (including conditional), inspect variables and the call stack, and watch expressions live.

![DevDebug Studio](images/devdebugv2.png)

## Project Structure
```text
DevDebug-Studio/
├── index.html         # App markup
├── styles.css         # Layout, themes, and panel styling
├── script.js          # Debugger logic and UI behavior
├── README.md          # Project documentation
└── images/
    └── devdebugv2.png # README screenshot
```

## Run
1. Quick start: open `index.html` directly in a browser.
2. Local server option:
   - From `DevDebug-Studio/`, run:
     ```bash
     python3 -m http.server 8000
     ```
   - Open `http://localhost:8000`.
3. Note: Acorn is loaded from a CDN, so internet access is required unless bundled locally.

## Requirements
- A modern web browser
- Optional: Python 3 (only needed for local server mode)
- Internet connection for CDN dependency (Acorn), unless vendored locally

## Browser Support
- Google Chrome (recent versions)
- Microsoft Edge (recent versions)
- Mozilla Firefox (recent versions)
- Safari (recent versions)

## How to Use
1. Click `Run` to start execution, or use `Step Over` / `Step Into` for line-by-line control.
2. Toggle breakpoints by clicking the gutter or line numbers.
3. Use `Alt`/`Meta` + click on a breakpoint to create a conditional breakpoint.
4. Use `Continue` to resume after breakpoints and `Stop` to reset execution.
5. Add watch expressions in the Watches panel and edit variables by double-clicking values.
6. Use `Step Back` or the timeline scrubber to inspect earlier execution states.
7. Manage code tabs with `+`, close buttons, and `Clear Code` for the active tab.
8. Toggle Light/Dark mode; preference is persisted locally.

## How It Works
- Parses JavaScript using Acorn to build an executable step list.
- Advances execution one step at a time and updates highlighted lines.
- Evaluates breakpoints and conditional breakpoint expressions.
- Refreshes variables, call stack, watches, and console panels per step.
- Stores code, tabs, breakpoints, watches, and theme in localStorage.
- Supports timeline-based navigation across recorded execution snapshots.

## Features
- Run/step controls (`Step Over`, `Step Into`, `Step Out`, `Step Back`, `Continue`)
- Breakpoints and conditional breakpoints
- Timeline scrubber and state replay
- Watches panel with live expression tracking
- Editable variables panel
- Example loader and custom example saving
- Multi-tab editing with close/add actions
- `Clear Code` action for active tab
- Light/Dark mode with local persistence

## Limitations
- Focused on JavaScript debugging workflows only.
- Uses client-side simulation and may not match full runtime edge cases.
- CDN dependency for parser loading unless bundled locally.
- Very large scripts may reduce responsiveness in browser-only mode.

## Privacy
- All code execution and analysis happens in the browser.
- No backend upload is required by default.
- Project state (tabs, watches, breakpoints, theme) is stored in localStorage.

## Roadmap
- Add optional local parser bundle to remove CDN requirement.
- Improve execution fidelity for advanced JavaScript patterns.
- Add import/export for debugger sessions.
- Add keyboard shortcut help modal and command palette.
- Expand automated UI regression coverage.

## Detectable Languages
- JavaScript

## Notes
- No build step is required for local use.
- If external CDN resources are blocked, parser-dependent functionality may fail until dependencies are bundled locally.
