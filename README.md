# Cut the Noise

Cut the Noise is a local browser filter that makes busy websites calmer. Each supported site has its own native filters and optional word-rewrite rules.

## What It Does

- Keeps independent settings for X, Amazon, and Google.
- Removes or replaces site-specific words and phrases, either anywhere or only at the start of text.
- Compacts and tints promoted posts on X.
- Softens or hides sponsored search results on Amazon and Google.
- Mutes or hides Amazon products unrelated to the words in a keyword search.
- Mutes or hides Amazon's full-width sponsored and high-rating sections.
- Applies changes as dynamically loaded content appears.
- Stores synced settings locally through the browser extension API.

## How It Works

The extension uses a shared text-filtering engine and a small adapter for each website. Adapters own site-specific detection and presentation logic, while the shared engine handles settings, live DOM updates, and safe text restoration.

## Install From Source

1. Install dependencies with `pnpm install`.
2. Create a production extension with `pnpm build`.
3. Open `chrome://extensions` in Chrome or another Chromium browser.
4. Enable Developer mode and choose Load unpacked.
5. Select the generated `dist` directory.

## Settings

| Setting | Description |
| --- | --- |
| Word rules | Terms or phrases to remove or replace. Rules need at least 3 characters. |
| Scope | `Start` matches the beginning of text. `Anywhere` matches any whole-word occurrence. |
| Ignore case | Treats uppercase and lowercase matches as the same. |
| Replace with | Replacement text. Leave empty to remove the matched term. |
| Site filters | Website-aware controls such as promoted-post folding or sponsored-result softening. |
| Word quieting | Independent rewrite rules for each website. |

## Privacy

Cut the Noise does not send browsing data anywhere. It runs locally and stores only extension settings through Chrome sync.

## Development

- `pnpm dev` starts Vite in extension development mode.
- `pnpm typecheck` validates TypeScript.
- `pnpm lint` checks code quality.
- `pnpm test` runs focused filter-engine tests.
- `pnpm build` creates the unpackable extension in `dist`.

The Manifest V3 entry points live in `src/background`, `src/content`, and `src/popup`. Shared settings and site metadata live in `src/shared` and `src/sites`.
