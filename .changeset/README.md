# Changesets

This directory tracks intended-but-unreleased changes for the publishable
packages in `packages/`. Packages marked `"private": true` are never published.

## How to record a change

When a PR changes a publishable package's behavior or public surface, add a
changeset:

```bash
pnpm changeset
```

Pick the affected packages, choose the SemVer bump (patch / minor / major), and
write a one-line consumer-facing summary. Commit the generated
`.changeset/*.md` file with your PR.

## How a release happens

Releases run on `main` through `.github/workflows/changesets.yml`.

1. Your PR merges with a changeset in `.changeset/`. The workflow opens or
   updates a **"Version Packages"** PR that consumes every pending changeset,
   bumps the versions and writes the changelogs. It publishes nothing while a
   changeset is pending.
2. Merging the "Version Packages" PR empties `.changeset/`. The workflow runs
   again and **publishes** each package whose version is not on the registry.
   It then pushes one git tag per package (`<package>@1.2.3`) and
   creates a matching GitHub release.

> [!WARNING]
> **Merging is publishing.** Any merge to `main` that leaves `.changeset/`
> empty releases every unpublished version to npm immediately. Review a
> "Version Packages" PR as carefully as the code that produced it. You cannot
> undo an npm publish; you can only correct it with a new version.

Never edit `version` in `package.json` by hand. `changeset version` writes the
version and the changelog together, from the same source.

## Credentials

Publishing uses **npm trusted publishing**. There is no npm token. The
`publish` job presents a GitHub OIDC token, and npm mints a credential that
expires with the run. Only that job has `id-token: write`; building and packing
happen in a separate job with read-only access.

Each package needs a trusted publisher on npmjs.com (package → Settings →
Trusted publishing → GitHub Actions):

- Organization or user: `uxfront-com`
- Repository: `unframework`
- Workflow filename: `changesets.yml`

The trusted publisher is bound to the workflow **filename**. If you rename
`changesets.yml`, npm revokes the credential and the release fails with a `404`
that reads like a missing package.

npm can only attach a trusted publisher to a package that already exists. A
brand-new package needs its first version published by hand
(`npm publish --access public` from the package directory) before CI can take
over.
