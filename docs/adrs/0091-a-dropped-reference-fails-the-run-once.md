# ADR-0091: A reference that did not finish a case fails the run once

- **Status:** Accepted
- **Date:** 2026-11-11
- **Plan:** §7.2 (L10), §7.4, §7.7, P2; ADR-0018, ADR-0019, ADR-0029, ADR-0057, ADR-0066

## Context

L10 compares each follower with the reference's capture from the same run, live or in update
mode, and the reference runs first (`sequence.groupOrder`, ADR-0018). Until now a follower that
found no capture failed L10 with `missing-reference-capture`, whatever the reason.

A full corpus run under load once failed 1090 of 1526 files that way: every follower's L10 said
`missing-reference-capture`, the run logged one `VITEST_BROWSER_CONNECTION_CLOSED`, and
`browser:vue` reported no failure. Killing one of `browser:vue`'s renderer processes partway
through a run reproduces it. Vitest 5.0.3 does three things when one tester page closes:

- `@vitest/browser` closes the page's RPC with a `BrowserConnectionError`.
- `BrowserPool.reject` cancels the pool, which empties the project's queue. The project's
  remaining spec files never run, and no reporter counts them as failed or passed.
- `executeTests` runs each `groupOrder` group under `Promise.allSettled`, so the followers' group
  starts anyway. The connection error reaches the reporters only as an unhandled error at the end.

The followers then fail hundreds of times for a cause that points away from the real one. The
trigger is the host: a renderer that died under the machine's load. The harness can't remove it.
Re-running the dropped files would be a retry (§7.7), and keeping the project's other pages
running needs a change to Vitest's pool.

## Decision

- Each browser project reports the case spec files it finished. The setup file's `aroundAll` hook
  calls `ufSpecFinished` once the file's tests and `afterAll` hooks have run, so a file whose page
  died is never reported. The command resolves before the file ends, so before a later
  `groupOrder` group starts. The record lives in Vitest's main process, keyed by run, as the
  reference's captures are.
- A follower that finds no capture gets the new outcome `reference-not-run` only when the case's
  reference (`caseReference`, ADR-0057) has a browser project in the run and that project didn't
  finish the case. Two cases still fail with `missing-reference-capture`: a reference left out of
  the run with `--project`, and a reference that finished the case without capturing the scenario.
- `expectParity` records `reference-not-run` as L10 `skip(reference not run: <project> did not
finish this case's spec file in this run)`. The test doesn't fail at L10. Of a cell's records,
  this skip ranks above a pass and above every other skip, so it is never hidden.
- The summary never accepts that skip. It folds everything a drop causes into one problem per
  reference project, listed first: the blocked follower cells, the reference's missing browser
  cells of the cases it didn't finish, and the scenario differences of those cases. The problem
  names the project, how many of its spec files didn't finish and how many follower cells were
  blocked. It quotes the errors Vitest reported outside every test in the runs that recorded those
  cells, which the parity reporter keeps in the partial matrix as `errors`. Every other problem
  stays, and so a drop fails the run, filtered or not.

## Consequences

**Positive:**

- A dropped reference reads as one problem that names the project and Vitest's error, such as
  `browser:vue did not finish 76 of its spec files in this run (…); 444 follower cell(s) could not
be compared at L10. Vitest reported: … Browser connection was closed …`.
- The followers' other layers still run, and their results are real.
- The matrix gets no new cell status, so `MATRIX_VERSION` stays at 5. `errors` is optional.

**Negative:**

- The drop is still a failed run. The harness reports the cause, and doesn't remove it.
- A shard (`--shard`) can give a follower a case whose reference file sits in another shard. The
  follower then reads that the reference didn't finish the case. That run still fails, but it
  names a drop that didn't happen. CI's browser jobs don't shard.
- In update mode the shared artefacts in `node/policy.ts` still fail each follower with "did not
  write … earlier in this run". Only L10's reads follow this rule.

## Alternatives considered

- **Re-run the reference's dropped files.** That is a retry, which §7.7 forbids: it would hide the
  drop rather than report it.
- **Patch Vitest's pool to keep the project's other pages running.** That is upstream work, and
  the run would still lose the files of the page that died.
- **Stop the followers when the reference drops.** Their L7, L8, L9, L11 and L13 don't read the
  reference's run, so stopping them throws away real results.
- **Mark the cases from a reporter's `onTestModuleEnd`.** Nothing orders that event before the
  next `groupOrder` group starts, so a follower could read a case the reference finished as not
  finished. A browser command from the setup file is ordered by construction.
- **Accept the skip as a mechanical one.** A dropped reference would then read as green.
