# Domain and code map — GDGJobs

This page helps contributors locate product code. Read implementation and tests together before drawing conclusions about behavior.

| Area | Location |
|---|---|
| Application shell and routes | `src/app/`, `src/App.jsx` |
| Product features | `src/features/` |
| Shared data and utilities | `src/lib/` |
| Reusable interface components | `src/shared/ui/` |
| Database integration | `supabase/`, `src/features/` |
| Automated checks | `src/**/*.test.js`, `pnpm test` |

The project uses React and Vite. Follow existing module boundaries and keep changes focused on the feature being updated.
