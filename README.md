# Demo Interview Chat Widget: Secure Embeddable Grok Support Bot

This repo is a Turborepo monorepo demonstrating a secure, embeddable chat widget powered by xAI's Grok models. Uses Vercel AI SDK for streaming chat and a server proxy to prevent API key exposure in client code.

Apps:
- **apps/chatbot**: Proxy API (/api/chat with origin validation/model router), chat UI component, public/widget.js for embed.
- **apps/mock-site**: Example customer site with script tag + div embed demo.

## Quick Start
Assume repo cloned. 

1. **Install Deps**: `pnpm i` (PNPM workspace – installs shared + per-app deps).
2. **Env Config**: Copy `.env.example` to root `.env` or `apps/chatbot/.env.local`:
   - Add `XAI_API_KEY=sk-...` (from console.x.ai; set $5 spend limit for safe testing).
   - `ALLOWED_ORIGINS` includes localhost:3000/3001 for dev; add your domains (comma-separated).
   - Dev UX: Localhost auto-whitelisted – no manual change needed. For prod/customers, update env or extend server to dynamic whitelist (e.g., admin UI approves domains via customer-id).
3. **Run Dev** (two terminal tabs recommended):
   ```bash
   # Tab 1
   pnpm chatbot:dev    # http://localhost:3001

   # Tab 2
   pnpm mock:dev       # http://localhost:3000
   ```
   Or run both in one terminal: `pnpm dev` (prefixed logs `[chatbot]`/`[mock-site]`)
   - Chatbot: http://localhost:3001/chat (test UI/proxy directly; streams Grok responses).
   - Mock site: http://localhost:3000 (loads embedded widget – chat in bottom-right bubble).
4. **Interact & Test**:
   - On mock site: Type query (simple vs complex to see model router in console logs).
   - Security: Dev tools → Network → /api/chat calls show no key; change origin header → 403 "Unauthorized domain".
   - Origin Whitelist: Server checks `req.headers.origin` vs ALLOWED_ORIGINS. Frontend UX: Widget passes `data-customer-id` (script attr) as header for server lookup/dynamic allow (e.g., map id to origins in env/DB). Local dev auto-passes via localhost include.
   - Streaming: Real-time tokens via AI SDK – no lag/full wait.
5. **Build/Lint**: `pnpm turbo run build && pnpm turbo run lint` (Turbopack fast).
6. **Deploy**: Vercel chatbot app (env vars set in dashboard); widget.js static-served for embeds.

## Key Features & Constraints Met
- **Embeddable**: `<div id="x-support-widget"></div><script src="/widget.js" data-customer-id="demo"></script>` – mounts responsive chat bubble (direct React or iframe fallback).
- **Security**: Proxy `/api/chat` hides XAI_API_KEY (env only); origin validation (ALLOWED_ORIGINS env, e.g., localhost:3000); customerId header for multi-tenant. No leaks – test with curl/inspect.
- **Streaming & Routing**: AI SDK `useChat`/`streamText` for real-time tokens; auto-routes light/fast (grok-beta) vs reasoning models (grok-4-1) based on query complexity.
- **UX/Design**: shadcn clean/modern (Grok-like premium: neutral, responsive bubbles/avatars); theme support, loading/errors handled.
- **Scalability Prep**: Traces/logs in code; new milestones add evals/admin for bulk grading/improvements.
- **PNPM/Turbo**: Workspace for parallel apps; fast dev/build with caching.

## Testing & Quality
- **Unit Tests (Jest)**: `pnpm --filter chatbot test` – ChatWidget renders, submits, handles errors/loading/empty input, props (customerId/theme/onError). Edge cases: Mock hook for isolation.
- **E2E Tests (Playwright)**: `pnpm --filter chatbot test:e2e` (browsers via `npx playwright install`) – Full flows: Chat interaction, API security (403 unauthorized, 400 invalid/long input), embed toggle, responsive screenshots for UX review (premium aesthetic asserts).
- **Lint & Build**: `pnpm lint` (ESLint v9/Next config; fix warnings in deps via skips if needed), `pnpm --filter chatbot build:widget` (generates bundles), `pnpm turbo build` (full).
- **Manual**: Dev servers running, curl API health/security, inspect no key exposure, console logs for traces/debug.

## Milestones & Roadmap
Milestones 1-4 complete (see `@overview.md` for details/integration). New 5-8 focus scalability/evals/interactivity:
- 5: Dynamic model upgrades (light → reasoning mid-chat).
- 6: Tracing/logs for local evals (structured JSON per session).
- 7: Admin dash (login: admin/login123) for viewing/grading traces with Grok (bulk self-reinforcement).
- 8: AI SDK tools for interactive UI (e.g., ticket modal triggered in chat).

## Troubleshooting
- **Build Fails**: Check Vite alias/postcss for Tailwind v4; run `build:widget` after deps.
- **API Errors**: Verify .env.local (key/origins); test health `curl localhost:3001/api/chat`.
- **Install Timeout**: `rm -rf node_modules pnpm-lock.yaml && pnpm i` or use npm.
- **Embed Not Loading**: Ensure bundles built, script src correct (localhost:3001 for dev).
- **CORS/Origin**: Update ALLOWED_ORIGINS; logs show rejections.
- **Tests Fail**: Mock deps or install browsers; env key for real API tests.
- **Mobile Hotspot**: Works offline after install; no cloud deps except xAI API calls.

Deploy-ready (Vercel recommended for edge/API); extend for prod (DB for traces, auth). Feedback welcome!

## Testing Constraints
- **No Key Leak**: Widget JS inspectable but harmless; API proxy enforces security.
- **Whitelist Works**: Allowed origins stream; others 403 (test curl -H "Origin: bad.com").
- **Full Flow**: Mock embed → widget mount → proxy validate → Grok stream → UI update.
- **Easy Verify**: Post-`pnpm dev`, 2-min test: Chat on mock site, check logs/security.

See `@overview.md` for architecture, code examples, SDK details. Deploy-ready; extend for multi-customer.
