# DevDebug Studio

A single-page, visual JavaScript step debugger UI. It simulates stepping through code and displays variables, call stack, and console output.

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

## Features
- Run / step controls with adjustable speed
- Breakpoints (click line numbers or gutter)
- Step back and timeline scrubber
- Watches panel with expressions
- Variable panel with editable values
- Example loader + save custom examples
- Multiple file tabs
- Light/Dark mode toggle (saved to localStorage)
