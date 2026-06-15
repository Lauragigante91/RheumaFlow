---
name: CRA+craco jest component-render gotchas
description: What to wire up before a jest test can render real UI components (Radix/alias/date-fns) in this CRA+craco frontend.
---

Rendering a real UI component under jest (CRA + craco, no @testing-library installed) requires three pieces, or it fails with confusing errors:

1. **`@/` alias** — webpack resolves `@/...` to `src/...` but jest does not. Any component importing `@/lib/utils` (e.g. `src/components/ui/dialog.jsx`) throws `Cannot find module '@/lib/utils'`. Fix: add `jest.configure.moduleNameMapper { "^@/(.*)$": "<rootDir>/src/$1" }` in `craco.config.js` (craco merges this into CRA's jest config; package.json jest overrides are restricted).

2. **jsdom polyfills** — Radix (Dialog/Slider) needs `ResizeObserver`, `matchMedia`, `scrollIntoView`, and pointer-capture methods that jsdom lacks. CRA auto-loads `src/setupTests.js`; put the shims there.

3. **date-fns ESM** — `ItalianDatePicker.jsx` does `import { it } from "date-fns/locale"`; jest can't transpile that ESM under the default transformIgnorePatterns. Stub the date picker per-test with `jest.mock("../components/shared/ItalianDatePicker", () => ({ __esModule: true, default: () => null }))` rather than fighting transform config.

**Why:** these three failure modes appear one after another (whack-a-mole) the first time you try to render any dialog/heavy component in jest here; knowing all three up front saves several iterations.

**How to apply:** when writing a jest test that mounts a real component tree (not a pure function), expect to need 1+2 globally and 3 (plus mocking `../lib/api` and `sonner`) per test. Render via `react-dom/client` `createRoot` + React 19 `act` (no @testing-library present). Note: unmounting a Radix dialog prints a long non-fatal deletion-effects stack to stderr — the suite still passes.
