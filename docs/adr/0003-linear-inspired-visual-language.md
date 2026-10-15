# ADR-0003: The product UI follows a Linear-inspired visual language
Date: 2026-09-30 · Status: Accepted
Deciders: Alex Grozav (Operator)
Supersedes: — · Superseded by: —

## Context
The deck’s indigo-and-Archivo styling served a presentation. The product needs a daily-driver aesthetic for dense, keyboard-heavy work. Linear’s design is the recognized benchmark: calm neutral surfaces, one accent, themes generated from base, accent, and contrast in a perceptual color space, Inter and Inter Display, fewer and smaller icons, and predictable chrome.

## Decision
We will design the product UI in a Linear-inspired visual language, implemented as DTCG tokens generated from three inputs (base, accent, contrast) in OKLCH, with Inter, Inter Display, and a monospace for technical values.

## Consequences
- Good: a proven, low-fatigue aesthetic; high-contrast themes come for free from the generator; users of modern trackers feel at home.
- Bad: less visual distinctiveness, so UDAX has to earn identity through the canvas, the status glyphs, and agent presence rather than color. There is a risk of looking derivative if we copy rather than adapt.
- Neutral: the deck’s mockups remain the reference for structure and behavior, not styling. The status glyph shapes carry over.

## Revisit triggers
- User research shows the aesthetic hurts recognition or brand recall.
