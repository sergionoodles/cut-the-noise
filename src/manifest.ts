import { defineManifest } from "@crxjs/vite-plugin";

import { supportedSiteMatches } from "./sites/catalog";

export default defineManifest({
  manifest_version: 3,
  name: "Cut the Noise",
  version: "2026.7.20",
  description: "A calm, local filter layer for the websites you use.",
  permissions: ["storage"],
  host_permissions: supportedSiteMatches,
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Cut the Noise",
    default_icon: {
      16: "icon16.png",
      48: "icon48.png",
      128: "icon128.png",
    },
  },
  icons: {
    16: "icon16.png",
    48: "icon48.png",
    128: "icon128.png",
  },
  content_scripts: [
    {
      matches: supportedSiteMatches,
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
});
