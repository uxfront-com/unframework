// The one spelling of a case's area, a case's name and a scenario's name. Each becomes part of an
// artefact's file name (`dom.<scenario>.html`, `<scenario>-chromium-linux.png`) and of the paths
// that `pnpm test:baselines` matches in a shell before it copies them into the repository
// (KEBAB in tests/integration/scripts/baselines.sh, which a harness test holds to this rule).
// So every check of such a name uses this pattern: a name one accepts and another refuses
// would pass the tests and then hold back every baseline. No imports: the browser half
// (`expectParity`) loads this module too.

/** Lower-case letters and digits in words joined by single hyphens, such as `after-click`. */
export const KEBAB_CASE: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
