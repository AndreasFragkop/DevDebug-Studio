# DevDebug Studio

DevDebug Studio is a browser‑based JavaScript step debugger that lets you run code, step through execution, set breakpoints, inspect variables and the call stack, and watch expressions live. It’s a single‑page app with a VS‑Code‑style interface, example loader, timeline scrubber, and light/dark themes—built to make understanding program flow visual and interactive.

![DevDebug Studio](images/devdebug.png)

## Files
- `index.html` – App markup
- `styles.css` – Styling
- `script.js` – Debugger simulation logic

## Run
Open `index.html` in a browser.

If you want a local server:

```sh
python3 -m http.server
```

Then visit `http://localhost:8000`.

## How It Works
1. **Step list generation**: The app parses JavaScript with Acorn and builds a list of executable lines.
2. **Stepping**: Each step highlights the active line and updates the UI panels.
3. **Breakpoints**: Click the gutter or line numbers to toggle breakpoints.
4. **State panels**: Variables, call stack, watches, and console output refresh after each step.
5. **Persistence**: Code, tabs, breakpoints, watches, and theme are saved to localStorage.
6. **Timeline**: The scrubber lets you jump back to a previously recorded step.

## Features
- Run / step controls with adjustable speed
- Breakpoints (click line numbers or gutter)
- Step back and timeline scrubber
- Watches panel with expressions
- Variable panel with editable values
- Example loader + save custom examples
- Multiple file tabs with close buttons
- Clear Code button for the active tab
- Light/Dark mode toggle (saved to localStorage)
