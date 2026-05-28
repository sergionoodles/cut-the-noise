# Repository Guidelines

## Project Structure & Module Organization

This is a plain Chrome Manifest V3 extension named "Cut the Noise". Core files live at the repository root:

- `manifest.json` declares metadata, permissions, scripts, popup, and icons.
- `content.js` runs on `https://x.com/*` and handles page scanning, replacement, and promoted-post handling.
- `background.js` manages toolbar icon state and extension background behavior.
- `popup.html` and `popup.js` implement the settings UI and persistence through `chrome.storage.sync`.
- `icons/` contains extension icons; `resources/` contains promotional or documentation images.

There is currently no separate `src/`, `test/`, or build output directory.

## Build, Test, and Development Commands

No dependency installation or bundling step is required. Edit the root files directly, then load this directory as an unpacked extension.

For local verification, open `chrome://extensions`, enable Developer Mode, choose "Load unpacked", and select this repository. After edits, use the extension reload button before retesting on `https://x.com/`.

## Coding Style & Naming Conventions

Use modern JavaScript with semicolons and clear function names. Existing files use two-space indentation in `popup.js`; keep nearby style consistent. Prefer `const` and `let` over `var`, early returns, and small helpers for reusable DOM or Chrome API behavior.

Keep Chrome extension APIs isolated to the files that own them: content-page mutation logic belongs in `content.js`, toolbar or tab behavior in `background.js`, and settings UI logic in `popup.js`.

## Testing Guidelines

There is no automated test suite yet. Manually test the main workflows after behavior changes:

- Settings save and reload correctly from the popup.
- Keyword rules apply on matching X pages.
- Promoted-post collapse and tint options behave independently.
- Toolbar indicator changes only for supported `https://x.com/` tabs.

When adding tests later, prefer focused unit tests for rule normalization and DOM transformation helpers, named like `content.test.js`.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries, for example `Add option to tone down promoted posts`. Follow that pattern: describe the user-visible change or refactor in one concise sentence.

Pull requests should include a summary, manual verification steps, affected browser/version, and screenshots or screen recordings for popup UI changes. Link related issues when available.
