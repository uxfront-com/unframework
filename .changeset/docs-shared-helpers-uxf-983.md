---
"@unframework.dev/target-angular": minor
"@unframework.dev/diagnostics": minor
---

Name the shared helpers in two messages. Angular's `child-root-scope` reason, which UF4003 prints, now says each root node binds the shared `ScopeAttributes` directive (`[ufScope]`), where it said "an inline attribute directive". UF4001's description now says a target emulates a feature "with a helper", since most helpers live in the tree's `_unframework/` directory rather than inline.
