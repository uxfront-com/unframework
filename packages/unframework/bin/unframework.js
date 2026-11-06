#!/usr/bin/env node
// ADR-0016: the umbrella loads its tooling lazily.
const { main } = await import("@unframework/cli");
process.exitCode = await main(process.argv.slice(2));
