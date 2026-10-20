# RFC-0004: Which desktop shell, and when?
Status: In review
Author: Claude (for Alex Grozav) · Reviewers: Alex Grozav · Class: 2 · Comment window closes: 2026-10-05

## Problem
UDAX needs native affordances (notifications, deep links, a tray runner, auto-update, OS keychain) and a Linear-grade feel. The UI is a web app served by the engine (ADR-0002), so a desktop shell is packaging, not a second UI. The question is which shell, and whether it blocks earlier milestones.

## Options considered

### Option A: Web-first, then Tauri 2 in M17
- **For**: small binaries and memory footprint; a Rust core that can embed the engine directly (see RFC-0001 Option A); a strict capability-based security model; a mature updater and plugins (notifications, deep links, tray, keychain).
- **Costs**: system WebViews differ (WebKit on macOS and Linux, WebView2 on Windows), so canvas, WebGL, and xterm behavior need cross-engine testing.
- **Risks**: a WebKit-specific performance or rendering bug in the canvas or terminal.

### Option B: Electron
- **For**: one Chromium everywhere means consistent rendering and performance, and a vast ecosystem. Linear, VS Code, and Cursor ship on Electron.
- **Costs**: large binaries and a heavy memory footprint; a Node main process alongside a Rust engine (two runtimes) if RFC-0001 picks Rust.
- **Risks**: security hardening is on us (context isolation, IPC surface).

### Option C: Web-only (PWA) for v1
- **For**: zero packaging work; notifications through the Web Notifications API; install as a PWA.
- **Costs**: no tray runner, weaker deep links, no OS keychain, and background behavior limited by the browser.

## Trade-off summary
| | A: Tauri 2 | B: Electron | C: PWA only |
|---|---|---|---|
| Footprint | **Small** | Large | **None** |
| Rendering consistency | Fair | **Best** | Depends on browser |
| Engine embedding (if Rust) | **Native** | Sidecar | N/A |
| Native affordances | Very good | **Best** | Fair |
| Delivery cost | Medium | Medium | **Lowest** |

## Recommendation
**Option A**, delivered in M17, with the web app as the primary surface until then. Playwright runs the E2E suite against WebKit from M5 so WebView differences surface early.

**The strongest argument against**: Linear’s own desktop app is Electron, and consistent Chromium is valuable for a canvas-heavy UI. Revisit trigger: a WebKit rendering or performance bug that blocks an M5, M10, or M11 exit criterion for more than one week. In that case, switch to Electron (Option B).

## Open questions
- Should the desktop app run the engine in-process or as a managed sidecar? Owner: engine lead. Resolve by M16.

## Decision log
Pending.
