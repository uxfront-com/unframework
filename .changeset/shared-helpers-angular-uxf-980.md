---
"@unframework.dev/target-angular": minor
"@unframework.dev/unplugin": minor
---

Angular shares its helpers in `_unframework/` (ADR-0121). `ScopeAttributes`, `TextCaret`, `TrustedHtmlPipe`, `styleObject`, the model helpers, `queueHook` and one directive per listener event and option are modules of their own, which every component imports and lists in its `imports`. `Transition` and `TransitionRegion` stay inline, because `inject` finds a region across component hosts. `api.getCompiled` in the unplugin now also gives a shared helper module's text, so Angular's ngtsc reads each one and compiles it ahead of time.
