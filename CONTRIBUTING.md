# Contributing to GDGJobs

Thanks for helping improve the project. Start with the [project overview](README.md) and [local setup](SETUP.md), then keep each change focused and easy to review.

## Before opening a pull request

- Create a branch for your change; do not push directly to `main`.
- Follow the repository's existing style and avoid unrelated edits.
- Run the relevant checks for the changed area. The common checks are:

  ```powershell
  pnpm lint
  pnpm test
  pnpm build
  ```

- For interface changes, include a short description of the affected screens and screenshots when useful.
- For behavior or data changes, describe expected behavior and how it was validated.
- Keep credentials, personal information, and private operational material out of commits and pull requests.

## Pull request description

Include:

1. The problem and the intended change.
2. Relevant validation performed and any known limitation.
3. Screenshots for visual changes, when useful.

Use a clear commit or pull request title. Conventional Commit prefixes such as `feat`, `fix`, `docs`, `test`, and `chore` are encouraged.

## Scope and review

Prefer small, cohesive pull requests. Changes that affect data contracts, authentication, or external services should explain their impact and validation clearly so maintainers can review them.

