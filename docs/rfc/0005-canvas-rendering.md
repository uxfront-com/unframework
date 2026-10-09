# RFC-0005: How should the issue-graph canvas be rendered?
Status: In review
Author: Claude (for Alex Grozav) · Reviewers: Alex Grozav · Class: 2 · Comment window closes: 2026-10-05

## Problem
The canvas (deck slides 5–10) shows up to thousands of issues with semantic zoom across four altitudes: dots, pills, cards, and detail. Cards carry rich text, avatars, PR pills, and live agent rows. It must hold 60 fps pan and zoom at 2,000 nodes, keep positions stable as statuses change, support keyboard traversal, and stay accessible through a mirrored outline.

## Options considered

### Option A: React Flow for the card altitudes plus a PixiJS layer for dots and pills, with ELK layout in a worker
- **For**: DOM nodes where richness, text selection, focus, and accessibility matter; GPU rendering where the count is high and detail is low. React Flow provides pan and zoom, a node and edge model, a minimap, and visible-only rendering. ELK’s layered algorithm produces clean left-to-right trees, and running it in a worker keeps the main thread free. The deck prototype already proved the counter-scaled altitude model in DOM.
- **Costs**: two renderers kept in sync by one altitude controller.
- **Risks**: seams during cross-fades between renderers.

### Option B: Pure WebGL or Canvas (PixiJS or a custom renderer) for every altitude
- **For**: maximum performance everywhere; one rendering path.
- **Costs**: rich text, inline controls, focus, and accessibility all have to be rebuilt by hand.
- **Risks**: large engineering cost for card-level polish.

### Option C: The tldraw SDK
- **For**: a mature infinite canvas with multiplayer, strong interaction polish, and extensibility.
- **Costs**: whiteboard semantics rather than a graph with automatic layout; commercial licensing terms apply for production use; layout and semantic zoom would still be custom.
- **Risks**: fighting a freeform model to get a strict tree layout.

## Trade-off summary
| | A: Hybrid | B: Pure WebGL | C: tldraw |
|---|---|---|---|
| Card richness and accessibility | **Best** | Poor | Good |
| Performance at 2k+ nodes | Very good | **Best** | Good |
| Build effort | Medium | High | Medium |
| Fit to tree layout | **Best** | Good | Fair |
| Licensing | MIT | MIT (PixiJS) | Commercial |

## Recommendation
**Option A.** It puts each renderer where it is strongest and matches the prototype.

**The strongest argument against**: two renderers double the surface for visual bugs. If cross-fade seams or state drift can’t be made invisible in M5, fall back to DOM-only for pills (virtualized) and keep WebGL for dots alone.

## Open questions
- Edge bundling threshold and algorithm for dense dependency graphs. Owner: UI lead. Resolve by M16.

## Decision log
Pending.
