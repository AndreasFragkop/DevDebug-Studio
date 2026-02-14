// =========================
// State and configuration
// =========================
// Runtime state for the debugger simulation
// (these values are mutated during stepping)
let code = '';
let ast = null;
let executionSteps = [];
let currentStep = -1;
let isRunning = false;
let isPaused = false;
let currentLine = null;
let autoRunInterval = null;
let stepDelay = 500;
let breakpoints = new Set();
let callStack = [];
let variables = {};
let consoleOutput = [];
let history = [];
let watches = [];
let watchHistory = {};
let originalConsoleLog = console.log;
let originalConsoleError = console.error;
let buffers = {};
let activeTab = 'main.js';
let breakpointConditions = new Map();
let stepSnapshots = [];

// Keys used for localStorage persistence
const STORAGE_KEYS = {
    code: 'devdebug.code',
    breakpoints: 'devdebug.breakpoints',
    watches: 'devdebug.watches',
    buffers: 'devdebug.buffers',
    activeTab: 'devdebug.activeTab',
    breakpointConditions: 'devdebug.breakpointConditions',
    customExamples: 'devdebug.customExamples',
    theme: 'devdebug.theme',
};

// =========================
// DOM references
// =========================
const editor = document.getElementById('editor');
const lineNumbers = document.getElementById('line-numbers');
const breakpointGutter = document.getElementById('breakpoint-gutter');
const currentLineMarker = document.getElementById('current-line-marker');
const currentLineHighlight = document.getElementById('current-line-highlight');
const variablesPanel = document.getElementById('variables');
const callstackPanel = document.getElementById('callstack');
const consolePanel = document.getElementById('console');
const statusText = document.getElementById('status-text');
const statusPos = document.getElementById('status-pos');
const watchInput = document.getElementById('watch-input');
const watchAddBtn = document.getElementById('watch-add-btn');
const watchList = document.getElementById('watch-list');
const errorOverlay = document.getElementById('error-overlay');
const timelineRange = document.getElementById('timeline-range');
const speedPreset = document.getElementById('speed-preset');
const saveExampleBtn = document.getElementById('save-example-btn');
const customExamples = document.getElementById('custom-examples');
const addTabBtn = document.getElementById('add-tab-btn');

const runBtn = document.getElementById('run-btn');
const stepBtn = document.getElementById('step-btn');
const stepIntoBtn = document.getElementById('step-into-btn');
const stepOutBtn = document.getElementById('step-out-btn');
const stepBackBtn = document.getElementById('step-back-btn');
const continueBtn = document.getElementById('continue-btn');
const stopBtn = document.getElementById('stop-btn');
const speedInput = document.getElementById('speed');
const speedValue = document.getElementById('speed-value');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// =========================
// Example code snippets
// =========================
const examples = {
    fibonacci: `// Fibonacci sequence generator
function fibonacci(n) {
    if (n <= 1) {
        return n;
    }

    const a = fibonacci(n - 1);
    const b = fibonacci(n - 2);
    return a + b;
}

function main() {
    console.log("Calculating fibonacci(5)");
    const result = fibonacci(5);
    console.log("Result:", result);
}

main();`,
    factorial: `// Factorial calculator
function factorial(n) {
    console.log("Calculating factorial of", n);

    if (n <= 1) {
        return 1;
    }

    const prev = factorial(n - 1);
    const result = n * prev;

    console.log(n, "! =", result);
    return result;
}

const num = 5;
const answer = factorial(num);
console.log("Final answer:", answer);`,
    bubblesort: `// Bubble sort algorithm
function bubbleSort(arr) {
    const n = arr.length;

    for (let i = 0; i < n - 1; i++) {
        console.log("Pass", i + 1);

        for (let j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                // Swap
                const temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
                console.log("Swapped:", arr[j], "and", arr[j+1]);
            }
        }

        console.log("Array:", arr);
    }

    return arr;
}

const numbers = [64, 34, 25, 12, 22];
console.log("Original:", numbers);
const sorted = bubbleSort(numbers);
console.log("Sorted:", sorted);`,
    recursion: `// Countdown with recursion
function countdown(n) {
    console.log("Count:", n);

    if (n <= 0) {
        console.log("Blastoff! 🚀");
        return;
    }

    countdown(n - 1);
}

countdown(5);`,
    closure: `// Closure example
function createCounter() {
    let count = 0;

    return function increment() {
        count++;
        console.log("Count is now:", count);
        return count;
    };
}

const counter = createCounter();
counter();
counter();
counter();`
};

// =========================
// Initial setup
// =========================
// Restore persisted state and prime UI
restoreState();
updateLineNumbers();
updateBreakpoints();
renderWatches();
updateStatusBar();
renderCustomExamples();
renderTabs();
syncEditorWithActiveTab();
updateTimeline();
applySavedTheme();

// Debounced line-number refresh to avoid heavy DOM updates per keystroke
const debouncedLineNumbers = debounce(updateLineNumbers, 80);
editor.addEventListener('input', () => {
    debouncedLineNumbers();
    persistCode();
    buffers[activeTab] = editor.value;
    persistBuffers();
});
editor.addEventListener('scroll', syncScroll);

// =========================
// UI controls and event handlers
// =========================
// Speed control
speedInput.addEventListener('input', (e) => {
    stepDelay = parseInt(e.target.value, 10);
    speedValue.textContent = stepDelay + 'ms';
    speedPreset.value = String(stepDelay);
});

// Speed preset dropdown
speedPreset.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    stepDelay = val;
    speedInput.value = String(val);
    speedValue.textContent = stepDelay + 'ms';
});

// Light/Dark theme toggle
themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    themeToggleBtn.textContent = isLight ? '🌙 Dark' : '☀ Light';
    localStorage.setItem(STORAGE_KEYS.theme, isLight ? 'light' : 'dark');
});

// Example buttons
document.querySelectorAll('.example-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const example = btn.dataset.example;
        if (!example) return;
        editor.value = examples[example];
        updateLineNumbers();
        buffers[activeTab] = editor.value;
        persistBuffers();
        reset();
    });
});

// Save current editor content as a custom example
saveExampleBtn.addEventListener('click', () => {
    const name = window.prompt('Name this example:');
    if (!name) return;
    const key = `custom:${name}`;
    examples[key] = editor.value;
    persistCustomExample(key, editor.value);
    renderCustomExamples();
});

// Line number breakpoints
lineNumbers.addEventListener('click', (e) => {
    toggleBreakpointFromEvent(e, lineNumbers);
});

// Breakpoint handling
breakpointGutter.addEventListener('click', (e) => {
    toggleBreakpointFromEvent(e, breakpointGutter);
});

// Control buttons
runBtn.addEventListener('click', run);
stepBtn.addEventListener('click', stepOver);
stepIntoBtn.addEventListener('click', stepInto);
stepOutBtn.addEventListener('click', stepOut);
stepBackBtn.addEventListener('click', stepBack);
continueBtn.addEventListener('click', continueExecution);
stopBtn.addEventListener('click', stop);

// Add a new file tab
addTabBtn.addEventListener('click', () => {
    const name = window.prompt('New file name:', 'new.js');
    if (!name) return;
    if (buffers[name]) return;
    buffers[name] = '';
    activeTab = name;
    persistBuffers();
    persistActiveTab();
    renderTabs();
    syncEditorWithActiveTab();
});

// Panel collapse (delegated for robustness)
document.addEventListener('click', (event) => {
    const header = event.target.closest('.panel-header');
    if (!header) return;
    const panel = header.closest('.panel');
    if (!panel) return;

    panel.classList.toggle('collapsed');
    const icon = header.querySelector('.expand-icon');
    const isCollapsed = panel.classList.contains('collapsed');
    header.setAttribute('aria-expanded', String(!isCollapsed));
    if (icon) {
        icon.textContent = isCollapsed ? '▶' : '▼';
    }
});

// Watch input handling
watchAddBtn.addEventListener('click', addWatchFromInput);
watchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWatchFromInput();
});

// Keyboard shortcuts for stepping
window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
        e.preventDefault();
        run();
    } else if (e.key === 'F10') {
        e.preventDefault();
        stepOver();
    } else if (e.key === 'F11' && e.shiftKey) {
        e.preventDefault();
        stepOut();
    } else if (e.key === 'F11') {
        e.preventDefault();
        stepInto();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        stop();
    }
});

// Timeline scrubber navigation
timelineRange.addEventListener('input', (e) => {
    const idx = parseInt(e.target.value, 10);
    jumpToStep(idx);
});

// =========================
// UI helpers (gutters, scroll sync)
// =========================
function updateLineNumbers() {
    const lines = editor.value.split('\n');
    lineNumbers.innerHTML = lines.map((_, i) => `${i + 1}<br>`).join('');
    breakpointGutter.style.height = lineNumbers.scrollHeight + 'px';
}

function syncScroll() {
    lineNumbers.scrollTop = editor.scrollTop;
    breakpointGutter.scrollTop = editor.scrollTop;
    updateCurrentLinePosition();
}

function updateBreakpoints() {
    breakpointGutter.innerHTML = '';
    const lineHeight = 22;
    const offset = 15;

    breakpoints.forEach((line) => {
        const bp = document.createElement('div');
        bp.className = 'breakpoint';
        bp.style.top = (line - 1) * lineHeight + offset + 'px';
        breakpointGutter.appendChild(bp);
    });

    const marker = currentLineMarker;
    if (marker) {
        breakpointGutter.appendChild(marker);
    }
    persistBreakpoints();
    persistBreakpointConditions();
}

// =========================
// Debugger controls (run/step/pause/stop)
// =========================
function run() {
    reset();
    code = editor.value;
    hideError();

    // Intercept console
    const logs = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = (...args) => {
        logs.push({ type: 'log', args: args });
        addConsoleOutput('log', args.map(String).join(' '));
    };
    console.error = (...args) => {
        logs.push({ type: 'error', args: args });
        addConsoleOutput('error', args.map(String).join(' '));
        pause();
    };

    try {
        // Parse code
        const wrappedCode = `(function() { ${code} })()`;
        const func = new Function(wrappedCode);
        // Execute once for real console/errors
        func();

        // Instrument code for step execution
        instrumentCode(code);

        // Enable controls
        isRunning = true;
        isPaused = false;
        updateControls();
        updateStatusBar('Running');

        // Start auto-stepping
        autoRun();
    } catch (error) {
        addConsoleOutput('error', error.message);
        showError(error.message);
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    }
}

// =========================
// Execution instrumentation and stepping
// =========================
function instrumentCode(code) {
    // Simplified step tracking - split by lines and statements
    const lines = code.split('\n');
    executionSteps = [];

    try {
        const parsed = acorn.parse(code, { ecmaVersion: 2020, locations: true });
        const statementLines = new Set();

        traverseAst(parsed, (node) => {
            if (!node.loc) return;
            if (
                node.type.endsWith('Statement') ||
                node.type === 'VariableDeclaration' ||
                node.type === 'ExpressionStatement'
            ) {
                statementLines.add(node.loc.start.line);
            }
        });

        Array.from(statementLines)
            .sort((a, b) => a - b)
            .forEach((lineNum) => {
                const line = lines[lineNum - 1] || '';
                if (line.trim()) {
                    executionSteps.push({ line: lineNum, code: line });
                }
            });
    } catch {
        // Fallback to line-based stepping if parse fails
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
                executionSteps.push({
                    line: index + 1,
                    code: line,
                });
            }
        });
    }

    currentStep = 0;
    stepSnapshots = new Array(executionSteps.length).fill(null);
    updateTimeline();
}

// Execute the next step in the precomputed step list
function step() {
    if (currentStep >= executionSteps.length) {
        stop();
        return;
    }

    const step = executionSteps[currentStep];
    saveSnapshot();

    // Highlight current line
    highlightLine(step.line);

    try {
        // Simulate execution and variable tracking
        trackExecution(step);

        currentStep++;
        saveStepSnapshot(currentStep - 1);
        updateTimeline();

        // Check breakpoint
        if (breakpoints.has(step.line)) {
            const cond = breakpointConditions.get(step.line);
            if (cond) {
                const ok = evaluateCondition(cond);
                if (ok) pause();
            } else {
                pause();
            }
        }
    } catch (error) {
        addConsoleOutput('error', error.message);
        showError(error.message);
        stop();
    }

    updateUI();
}

// Step variants (currently alias to step)
function stepOver() {
    step();
}

function stepInto() {
    step();
}

// =========================
// Simulated execution and state tracking
// =========================
function trackExecution(step) {
    // Simulate variable tracking (simplified)
    const code = step.code.trim();

    // Track function calls
    if (code.includes('function ') || code.match(/^\w+\s*\(/)) {
        const funcName = code.match(/function\s+(\w+)/) || code.match(/^(\w+)\s*\(/);
        if (funcName) {
            callStack.push({
                name: funcName[1],
                line: step.line,
            });
        }
    }

    // Track variable declarations
    const varMatch = code.match(/(const|let|var)\s+(\w+)\s*=\s*(.+)/);
    if (varMatch) {
        const [, , name, value] = varMatch;
        variables[name] = {
            value: value.replace(/;$/, ''),
            type: guessType(value),
        };
    }

    // Track console.log
    if (code.includes('console.log')) {
        const match = code.match(/console\.log\((.*)\)/);
        if (match) {
            addConsoleOutput('log', match[1]);
        }
    }

    // Simulate function returns
    if (code.includes('return') && callStack.length > 0) {
        callStack.pop();
    }
}

// Infer a simple type for display
function guessType(value) {
    if (value.match(/^\d+$/)) return 'number';
    if (value.match(/^["'].*["']$/)) return 'string';
    if (value.match(/^\[.*\]$/)) return 'array';
    if (value.match(/^\{.*\}$/)) return 'object';
    if (value === 'true' || value === 'false') return 'boolean';
    return 'unknown';
}

// Highlight the active source line in the editor gutter
function highlightLine(lineNum) {
    currentLine = lineNum;
    updateCurrentLinePosition();
}

function updateCurrentLinePosition() {
    if (!currentLine) return;
    const lineHeight = 22;
    const offset = 15;
    const top = (currentLine - 1) * lineHeight + offset - editor.scrollTop;
    currentLineHighlight.style.top = `${top}px`;
    currentLineHighlight.style.opacity = '1';
    currentLineMarker.style.top = `${top + 11}px`;
    currentLineMarker.style.opacity = '1';
}

// =========================
// Flow control helpers
// =========================
function stepOut() {
    // Continue until current function returns
    const targetStackDepth = callStack.length - 1;

    while (currentStep < executionSteps.length && callStack.length > targetStackDepth) {
        step();
    }
}

// Resume auto-stepping after a pause
function continueExecution() {
    isPaused = false;
    updateControls();
    updateStatusBar('Running');
    autoRun();
}

// Pause auto-stepping (e.g., at a breakpoint)
function pause() {
    isPaused = true;
    clearInterval(autoRunInterval);
    updateControls();
    updateStatusBar('Paused');
}

// Stop the run and clear highlights
function stop() {
    isRunning = false;
    isPaused = false;
    clearInterval(autoRunInterval);
    currentStep = -1;
    currentLine = null;
    currentLineHighlight.style.opacity = '0';
    currentLineMarker.style.opacity = '0';
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    updateControls();
    updateStatusBar('Stopped');
}

// Reset all runtime state and UI
function reset() {
    stop();
    callStack = [];
    variables = {};
    consoleOutput = [];
    executionSteps = [];
    currentStep = -1;
    history = [];
    stepSnapshots = [];
    updateUI();
}

// Auto-run loop for continuous stepping
function autoRun() {
    clearInterval(autoRunInterval);

    autoRunInterval = setInterval(() => {
        if (!isPaused && currentStep < executionSteps.length) {
            step();
        } else {
            clearInterval(autoRunInterval);
            if (currentStep >= executionSteps.length) {
                stop();
            }
        }
    }, stepDelay);
}

// Enable/disable UI buttons based on current state
function updateControls() {
    runBtn.disabled = isRunning;
    stepBtn.disabled = !isRunning || currentStep >= executionSteps.length;
    stepIntoBtn.disabled = !isRunning || currentStep >= executionSteps.length;
    stepOutBtn.disabled = !isRunning || callStack.length === 0;
    stepBackBtn.disabled = history.length === 0;
    continueBtn.disabled = !isRunning || !isPaused;
    stopBtn.disabled = !isRunning;
}

// Refresh all panels and status
function updateUI() {
    updateVariablesPanel();
    updateCallStackPanel();
    updateConsolePanel();
    renderWatches();
    updateStatusBar();
    updateControls();
}

// =========================
// Panel rendering
// =========================
function updateVariablesPanel() {
    if (Object.keys(variables).length === 0) {
        variablesPanel.innerHTML = '<div class="empty-state">No variables in scope</div>';
        return;
    }

    variablesPanel.innerHTML = Object.entries(variables)
        .map(
            ([name, data]) => `
                <div class="variable-item">
                    <span class="variable-name">${name}</span>
                    <span>
                        <span class="variable-value" data-var="${name}">${data.value}</span>
                        <span class="variable-type">${data.type}</span>
                    </span>
                </div>
            `,
        )
        .join('');

    variablesPanel.querySelectorAll('.variable-value').forEach((el) => {
        el.addEventListener('dblclick', () => {
            const name = el.dataset.var;
            const newVal = window.prompt(`New value for ${name}:`, variables[name].value);
            if (newVal === null) return;
            variables[name].value = newVal;
            variables[name].type = guessType(newVal);
            updateVariablesPanel();
            renderWatches();
        });
    });
}

function updateCallStackPanel() {
    if (callStack.length === 0) {
        callstackPanel.innerHTML = '<div class="empty-state">No active call stack</div>';
        return;
    }

    callstackPanel.innerHTML = callStack
        .slice()
        .reverse()
        .map(
            (frame, index) => `
                <div class="stack-frame ${index === 0 ? 'active' : ''}">
                    <div class="stack-function">${frame.name}()</div>
                    <div class="stack-location">Line ${frame.line}</div>
                </div>
            `,
        )
        .join('');
}

function updateConsolePanel() {
    if (consoleOutput.length === 0) {
        consolePanel.innerHTML = '<div class="empty-state">Console output will appear here</div>';
        return;
    }

    consolePanel.innerHTML = consoleOutput
        .map((output) => `<div class="console-output console-${output.type}">${output.message}</div>`)
        .join('');

    consolePanel.scrollTop = consolePanel.scrollHeight;
}

function addConsoleOutput(type, message) {
    consoleOutput.push({ type, message });
    updateConsolePanel();
}

function updateStatusBar(stateOverride) {
    const state = stateOverride || (isRunning ? (isPaused ? 'Paused' : 'Running') : 'Stopped');
    statusText.textContent = state;
    const lineText = currentLine ? currentLine : '—';
    const stepText = currentStep >= 0 ? currentStep + 1 : '—';
    statusPos.textContent = `Line: ${lineText} | Step: ${stepText}`;
}

function toggleBreakpointFromEvent(e, container) {
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top + editor.scrollTop;
    const lineHeight = 22;
    const line = Math.floor((y - 15) / lineHeight) + 1;
    if (line < 1) return;

    const wantsCondition = e.altKey || e.metaKey;
    if (wantsCondition) {
        const existing = breakpointConditions.get(line) || '';
        const cond = window.prompt('Breakpoint condition:', existing);
        if (cond === null) return;
        if (cond.trim() === '') {
            breakpointConditions.delete(line);
        } else {
            breakpointConditions.set(line, cond.trim());
            breakpoints.add(line);
        }
    } else {
        if (breakpoints.has(line)) {
            breakpoints.delete(line);
            breakpointConditions.delete(line);
        } else {
            breakpoints.add(line);
        }
    }

    updateBreakpoints();
}

function saveSnapshot() {
    history.push({
        currentStep,
        currentLine,
        callStack: JSON.parse(JSON.stringify(callStack)),
        variables: JSON.parse(JSON.stringify(variables)),
        consoleOutput: JSON.parse(JSON.stringify(consoleOutput)),
    });
    if (history.length > 200) {
        history.shift();
    }
}

function stepBack() {
    if (history.length === 0) return;
    const snapshot = history.pop();
    currentStep = snapshot.currentStep;
    currentLine = snapshot.currentLine;
    callStack = snapshot.callStack;
    variables = snapshot.variables;
    consoleOutput = snapshot.consoleOutput;
    updateCurrentLinePosition();
    updateUI();
}

// =========================
// Watch expressions
// =========================
function renderWatches() {
    if (!watchList) return;
    if (watches.length === 0) {
        watchList.innerHTML = '<div class="empty-state">No watch expressions</div>';
        return;
    }

    watchList.innerHTML = watches
        .map((expr, index) => {
            const value = evaluateWatch(expr);
            const historyText = watchHistory[expr] ? ` (prev: ${watchHistory[expr]})` : '';
            return `
                <div class="watch-item">
                    <span>${expr} = ${value}${historyText}</span>
                    <button class="btn" data-watch-index="${index}" aria-label="Remove watch">×</button>
                </div>
            `;
        })
        .join('');

    watchList.querySelectorAll('button[data-watch-index]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const index = Number(btn.dataset.watchIndex);
            watches.splice(index, 1);
            persistWatches();
            renderWatches();
        });
    });
}

// Add a new watch expression from the input field
function addWatchFromInput() {
    const value = watchInput.value.trim();
    if (!value) return;
    watches.push(value);
    watchInput.value = '';
    persistWatches();
    renderWatches();
}

function evaluateWatch(expr) {
    try {
        const scope = {};
        Object.entries(variables).forEach(([name, data]) => {
            scope[name] = coerceValue(data.value, data.type);
        });
        const keys = Object.keys(scope);
        const vals = Object.values(scope);
        const fn = new Function(...keys, `return (${expr});`);
        const result = fn(...vals);
        watchHistory[expr] = String(result);
        return String(result);
    } catch (err) {
        return `Error: ${err.message}`;
    }
}

function coerceValue(value, type) {
    if (type === 'number') return Number(value);
    if (type === 'boolean') return value === 'true';
    if (type === 'string') return value.replace(/^['"]|['"]$/g, '');
    if (type === 'array' || type === 'object') {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }
    return value;
}

// =========================
// Persistence (localStorage)
// =========================
function persistCode() {
    localStorage.setItem(STORAGE_KEYS.code, editor.value);
}

function persistBreakpoints() {
    localStorage.setItem(STORAGE_KEYS.breakpoints, JSON.stringify(Array.from(breakpoints)));
}

function persistWatches() {
    localStorage.setItem(STORAGE_KEYS.watches, JSON.stringify(watches));
}

function restoreState() {
    const savedCode = localStorage.getItem(STORAGE_KEYS.code);
    if (savedCode) {
        editor.value = savedCode;
    }
    const savedBps = localStorage.getItem(STORAGE_KEYS.breakpoints);
    if (savedBps) {
        breakpoints = new Set(JSON.parse(savedBps));
    }
    const savedWatches = localStorage.getItem(STORAGE_KEYS.watches);
    if (savedWatches) {
        watches = JSON.parse(savedWatches);
    }
    const savedBuffers = localStorage.getItem(STORAGE_KEYS.buffers);
    if (savedBuffers) {
        buffers = JSON.parse(savedBuffers);
    } else {
        buffers = { 'main.js': editor.value, 'utils.js': '' };
    }
    const savedActive = localStorage.getItem(STORAGE_KEYS.activeTab);
    if (savedActive) {
        activeTab = savedActive;
    }
    if (!buffers[activeTab]) {
        activeTab = Object.keys(buffers)[0] || 'main.js';
    }
    const savedConditions = localStorage.getItem(STORAGE_KEYS.breakpointConditions);
    if (savedConditions) {
        const entries = JSON.parse(savedConditions);
        breakpointConditions = new Map(entries);
        entries.forEach(([line]) => breakpoints.add(line));
    }
    const savedCustom = localStorage.getItem(STORAGE_KEYS.customExamples);
    if (savedCustom) {
        const items = JSON.parse(savedCustom);
        items.forEach(({ key, value }) => {
            examples[key] = value;
        });
    }
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'dark';
    const isLight = savedTheme === 'light';
    document.body.classList.toggle('light', isLight);
    themeToggleBtn.textContent = isLight ? '🌙 Dark' : '☀ Light';
}

// =========================
// Utilities
// =========================
function debounce(fn, wait) {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

function traverseAst(node, visit, parent = null) {
    if (!node || typeof node !== 'object') return;
    visit(node, parent);
    Object.keys(node).forEach((key) => {
        const value = node[key];
        if (Array.isArray(value)) {
            value.forEach((child) => traverseAst(child, visit, node));
        } else if (value && typeof value.type === 'string') {
            traverseAst(value, visit, node);
        }
    });
}


function updateTimeline() {
    if (!timelineRange) return;
    timelineRange.max = Math.max(0, executionSteps.length - 1);
    timelineRange.value = Math.max(0, Math.min(currentStep, executionSteps.length - 1));
}

function saveStepSnapshot(index) {
    stepSnapshots[index] = {
        currentStep,
        currentLine,
        callStack: JSON.parse(JSON.stringify(callStack)),
        variables: JSON.parse(JSON.stringify(variables)),
        consoleOutput: JSON.parse(JSON.stringify(consoleOutput)),
    };
}

function jumpToStep(index) {
    if (!stepSnapshots[index]) return;
    const snapshot = stepSnapshots[index];
    currentStep = snapshot.currentStep;
    currentLine = snapshot.currentLine;
    callStack = snapshot.callStack;
    variables = snapshot.variables;
    consoleOutput = snapshot.consoleOutput;
    updateCurrentLinePosition();
    updateUI();
}

function evaluateCondition(expr) {
    try {
        const scope = {};
        Object.entries(variables).forEach(([name, data]) => {
            scope[name] = coerceValue(data.value, data.type);
        });
        const keys = Object.keys(scope);
        const vals = Object.values(scope);
        const fn = new Function(...keys, `return (${expr});`);
        return Boolean(fn(...vals));
    } catch {
        return false;
    }
}

function showError(message) {
    if (!errorOverlay) return;
    errorOverlay.textContent = message;
    errorOverlay.style.display = 'block';
}

function hideError() {
    if (!errorOverlay) return;
    errorOverlay.textContent = '';
    errorOverlay.style.display = 'none';
}

function renderCustomExamples() {
    if (!customExamples) return;
    const keys = Object.keys(examples).filter((k) => k.startsWith('custom:'));
    if (keys.length === 0) {
        customExamples.innerHTML = '';
        return;
    }
    customExamples.innerHTML = keys
        .map((key) => `<button class="example-btn" data-example="${key}">${key.replace('custom:', '')}</button>`)
        .join('');
    customExamples.querySelectorAll('.example-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const example = btn.dataset.example;
            editor.value = examples[example];
            updateLineNumbers();
            buffers[activeTab] = editor.value;
            persistBuffers();
            reset();
        });
    });
}

function persistCustomExample(key, value) {
    const saved = localStorage.getItem(STORAGE_KEYS.customExamples);
    const items = saved ? JSON.parse(saved) : [];
    const existing = items.find((item) => item.key === key);
    if (existing) {
        existing.value = value;
    } else {
        items.push({ key, value });
    }
    localStorage.setItem(STORAGE_KEYS.customExamples, JSON.stringify(items));
}

function renderTabs() {
    const tabsContainer = document.querySelector('.tabs');
    if (!tabsContainer) return;
    const addBtn = document.getElementById('add-tab-btn');
    tabsContainer.querySelectorAll('.tab:not(.add-tab)').forEach((el) => el.remove());

    Object.keys(buffers).forEach((name) => {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.tab = name;
        tab.textContent = name;
        if (name === activeTab) tab.classList.add('active');
        tab.addEventListener('click', () => {
            buffers[activeTab] = editor.value;
            activeTab = name;
            persistBuffers();
            persistActiveTab();
            renderTabs();
            syncEditorWithActiveTab();
        });
        tabsContainer.insertBefore(tab, addBtn);
    });
}

function syncEditorWithActiveTab() {
    if (!buffers[activeTab]) buffers[activeTab] = '';
    editor.value = buffers[activeTab];
    updateLineNumbers();
    reset();
}

function persistBuffers() {
    localStorage.setItem(STORAGE_KEYS.buffers, JSON.stringify(buffers));
}

function persistActiveTab() {
    localStorage.setItem(STORAGE_KEYS.activeTab, activeTab);
}

function persistBreakpointConditions() {
    localStorage.setItem(STORAGE_KEYS.breakpointConditions, JSON.stringify(Array.from(breakpointConditions.entries())));
}
