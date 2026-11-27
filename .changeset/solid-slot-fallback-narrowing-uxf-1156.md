---
"@unframework.dev/target-solid": patch
"@unframework.dev/target-solid2": patch
---

Read a value a conditional narrows through the branch's accessor where a slot's fallback reads it, on Solid and Solid 2. A fallback like `{user ? <b>{slots.default?.() ?? user.name}</b> : null}` used to read `props.user.name` inside `<Show when={props.user}>`, which fails the type check (TS18048), and now reads `user().name` from `<Show>`'s callback.
