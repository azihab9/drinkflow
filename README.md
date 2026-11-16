# DrinkFlow — MATCHABOY PASID

Business management system for MATCHABOY PASID.

## Stack
- HTML, CSS, JavaScript
- Supabase Auth and Postgres (RLS)
- GitHub repository

## Current status
- Initial dashboard shell and responsive styling.
- Static catalog seed for 11 Matcha products.
- Supabase integration intentionally not enabled yet.

## Important security notes
- Never commit a Supabase service-role key or database password.
- Browser apps may use only the Supabase publishable/anon key, protected by verified RLS policies.
- Keep this repository private while developing. GitHub Pages on GitHub Free generally requires a public repository for project sites.

## Next steps
1. Verify Supabase RLS policies and transaction RPC.
2. Add Supabase URL and publishable key through a safe frontend config strategy.
3. Implement login, role-aware routing, and live dashboard queries.
4. Implement POS only after transaction, payment, cancellation, and inventory rules are verified.
