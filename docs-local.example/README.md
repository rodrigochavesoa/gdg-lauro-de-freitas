# Local workspace templates

This directory contains optional examples for configuring a local contributor workspace. Copy only the templates needed for your work into the ignored `docs-local/` directory and keep real credentials and personal data out of the repository.

```powershell
Copy-Item -Recurse docs-local.example docs-local
```

`docs-local/` is excluded from Git. These examples are not required to build or run the application; use [SETUP.md](../SETUP.md) for the public development setup.
