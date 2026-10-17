# Frontend testing

## Commands

```bash
npm ci          # install exact dependencies
npm test        # Vitest, single run
npm run build   # TypeScript type-check (tsc -b) + production build
npm run lint    # ESLint
```

Node 22 is used in CI. Vite 7 needs Node 20.19+ or 22.12+.

## Writing tests

- Put tests next to the code as `*.test.ts` or `*.test.tsx`.
- Tests run in Node by default. For React components, add `// @vitest-environment jsdom` as the first line and use `@testing-library/react`.
- Components that use routing hooks (`useNavigate`, `useParams`) must be rendered inside `<MemoryRouter>`.
- Call `cleanup` after each component test (`afterEach(cleanup)`), because Vitest globals are not enabled.
- Mock HTTP with `vi.mock("./apiAuth.ts", ...)`. Tests must never call the real backend.

Examples: `src/services/apiService.test.ts` (Node, mocked Axios) and `src/components/menu/MenuItemCard.test.tsx` (jsdom, React Testing Library).

## CI

`.github/workflows/ci.yml` runs install, lint, build and test for every pull request, every push to `feature/init` or any `feature/**` branch, and on manual dispatch.

**Lint is currently non-blocking:** the codebase has 98 pre-existing lint errors, mostly `no-explicit-any`. New code should not add lint errors. Make lint blocking once the existing errors are fixed.
