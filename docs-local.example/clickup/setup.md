# ClickUp workspace setup

This guide describes the local workspace files used by the repository's ClickUp sync scripts. Keep real workspace identifiers, task records, and credentials in the ignored `docs-local/clickup/` directory.

## Prepare local configuration

1. Create `docs-local/clickup/` if it does not exist.
2. Copy the relevant `*.example.json` files from this directory into it, removing the `.example` suffix.
3. Copy `docs-local.example/clickup.env.example` to `docs-local/clickup.env` and fill in the local credentials there.
4. Add sprint lists and task data to the local JSON configuration, following `task-description-template.md` and `task-metadata.md`.
5. Review the planned changes in ClickUp before syncing them.

Do not put real workspace IDs, member details, task IDs, or credentials in tracked files or pull request descriptions.
