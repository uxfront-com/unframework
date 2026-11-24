// Lighthouse CI on the homepage and five docs pages, served from dist with wrangler dev. The
// thresholds are the shared preset's (@uxfront/site-checks/lighthouse): every page fails below
// 0.95 in accessibility and best practices and below 1 in SEO, and the homepage also fails below
// 0.95 in performance. The docs pages are Docus's theme, which scores lower in performance on
// phones, so they don't assert it yet.
import { lighthouseConfig } from "@uxfront/site-checks/lighthouse";

export default lighthouseConfig({
  collect: {
    startServerCommand: "pnpm dlx wrangler@4 dev --port 8799",
    startServerReadyPattern: "Ready on",
    url: [
      "http://localhost:8799/",
      "http://localhost:8799/docs/getting-started/introduction",
      "http://localhost:8799/docs/getting-started/installation",
      "http://localhost:8799/docs/components/state",
      "http://localhost:8799/docs/reference/diagnostics",
      "http://localhost:8799/docs/tooling/cli",
    ],
  },
  matrix: [
    {
      matchingUrlPattern: ".*",
      categories: ["accessibility", "best-practices", "seo"],
    },
    {
      matchingUrlPattern: "^http://localhost:8799/$",
      categories: ["performance"],
    },
  ],
});
