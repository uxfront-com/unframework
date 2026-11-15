---
"@unframework.dev/type-oracle-tsgo": patch
---

Run `createTsgoOracle` on TypeScript `7.1.0-beta`, through its `typescript/sync` API, since `typescript/unstable/sync` is gone in 7.1. It gives the same shapes as on 7.0.2, and its `typescript` dependency is now `7.1.0-beta`, until 7.1.0 is published.
