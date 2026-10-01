<!-- Thanks for contributing! If this resolves an issue, link it here: Closes #123 -->

## What changed

<!-- For changes to a framework's output: the frameworks it affects, and why. -->

## Checklist

- [ ] The title follows [Conventional Commits](https://www.conventionalcommits.org), as in `feat(web): sell the next framework on the homepage`.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm check-types` and `pnpm test` pass.
- [ ] Changes to a published package: a changeset from `pnpm changeset` (see [`.changeset/README.md`](https://github.com/uxfront-com/unframework/blob/main/.changeset/README.md)).
- [ ] Homepage changes: `pnpm build`, then `pnpm --filter web lighthouse`, still scores 100 in every category.
