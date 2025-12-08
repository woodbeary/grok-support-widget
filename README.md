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
- **Embeddable**: `<div id="x-support-widget"></div><script src="/widget.js" data-customer-id="demo"></script>` – mounts responsive chat bubble.
- **Security**: Proxy hides key (server env only); origin lock blocks unauthorized (e.g., non-customer domains). No client exposure – passes inspect/network test.
- **Streaming/Model Router**: Vercel AI SDK `useChat`/`streamText` for SSE; heuristics route fast/reasoning Grok models.
- **UX for Origins**: Dev: Localhost auto-ok. Prod: Config via env/customer-id (widget sends id; server validates/adds dynamically if approved). Future: Frontend dashboard for customers to request domain whitelist (server approves).
- **PNPM/Turbo**: Consistent deps, parallel dev/build. $5 key limit ensures safe trials.

## Testing Constraints
- **No Key Leak**: Widget JS inspectable but harmless; API proxy enforces security.
- **Whitelist Works**: Allowed origins stream; others 403 (test curl -H "Origin: bad.com").
- **Full Flow**: Mock embed → widget mount → proxy validate → Grok stream → UI update.
- **Easy Verify**: Post-`pnpm dev`, 2-min test: Chat on mock site, check logs/security.

See `@overview.md` for architecture, code examples, SDK details. Deploy-ready; extend for multi-customer.
