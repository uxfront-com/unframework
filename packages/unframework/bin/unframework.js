#!/usr/bin/env node
// ADR-0016: the umbrella loads its tooling lazily. Its own `./cli` adds the commands that need
// packages above `@unframework.dev/cli`, such as `test` (ADR-0086).
const { main } = await import("@uxfront/unframework/cli");
process.exitCode = await main(process.argv.slice(2));
