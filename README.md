# Grok Chat Widget Demo

A production-ready, embeddable AI chat widget powered by **xAI's Grok models** and built with the **Vercel AI SDK**.

> **Built for xAI Interview** — Demonstrates secure proxy architecture, intelligent model routing, streaming UI, and agent-like interactive features.

---

## 🎯 Key Features

| Feature | Implementation |
|---------|----------------|
| **Streaming Chat** | AI SDK `useChat` hook + `streamText` for real-time token streaming |
| **Secure Proxy** | API key never exposed client-side; origin validation prevents unauthorized access |
| **Dynamic Model Routing** | Starts with `grok-beta` (fast), escalates to `grok-4-1` mid-chat for complex reasoning |
| **AI Tools** | `createTicket` tool triggers interactive modal for support escalation |
| **Admin Dashboard** | View traces, AI-grade conversations, generate self-improvement insights |
| **Embeddable** | Single script tag drops widget into any site |

---

## 🚀 Quick Start

```bash
# 1. Clone & install
git clone https://github.com/woodbeary/demo_interview_chatwidget.git
cd demo_interview_chatwidget
pnpm install

# 2. Configure env (add your xAI API key)
cp .env.example apps/chatbot/.env.local
# Edit: XAI_API_KEY=sk-...

# 3. Run both apps
pnpm dev

# Chatbot:   http://localhost:3001/chat
# Mock site: http://localhost:3000 (embedded widget)
# Admin:     http://localhost:3001/admin (login: admin/login123)
```

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Turborepo Monorepo                       │
├─────────────────────────┬───────────────────────────────────┤
│   apps/mock-site        │   apps/chatbot                    │
│   (Customer website)    │   (Grok-powered backend)          │
│                         │                                   │
│   ┌─────────────────┐   │   ┌─────────────────────────────┐ │
│   │  <script>       │───┼──►│  /api/chat (POST)           │ │
│   │  widget.js      │   │   │  • Origin validation        │ │
│   └─────────────────┘   │   │  • Model escalation         │ │
│                         │   │  • streamText → xAI Grok    │ │
│                         │   └─────────────────────────────┘ │
│                         │                                   │
│                         │   ┌─────────────────────────────┐ │
│                         │   │  /admin                     │ │
│                         │   │  • Trace viewer + grading   │ │
│                         │   │  • Self-reinforcement AI    │ │
│                         │   └─────────────────────────────┘ │
└─────────────────────────┴───────────────────────────────────┘
```

---

## 🛡 Security

- **API Key Protection**: `XAI_API_KEY` stays server-side, never in client bundles
- **Origin Validation**: Requests rejected if `Origin` header not in `ALLOWED_ORIGINS`
- **Admin Auth**: Cookie-based session + Basic Auth fallback

```bash
# Test origin security
curl -X POST http://localhost:3001/api/chat \
  -H "Origin: http://evil.com" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
# → 403 Unauthorized origin
```

---

## 📁 Project Structure

```
├── apps/
│   ├── chatbot/          # Main Grok chat app
│   │   ├── app/
│   │   │   ├── api/chat/route.ts    # Secure proxy + model routing
│   │   │   └── admin/page.tsx       # Traces dashboard
│   │   └── components/
│   │       └── ChatWidget.tsx       # Streaming UI + tool modals
│   └── mock-site/        # Demo customer site with embed
├── turbo.json            # Turborepo config
└── package.json          # Workspace root
```

---

## 🧪 Testing

```bash
# Unit tests (Jest)
pnpm --filter chatbot test

# E2E tests (Playwright)
pnpm --filter chatbot test:e2e

# Lint
pnpm turbo run lint
```

---

## 📦 Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **AI**: Vercel AI SDK v5, @ai-sdk/xai
- **UI**: shadcn/ui, Tailwind CSS, Radix primitives
- **Testing**: Jest, Playwright
- **Monorepo**: Turborepo + pnpm workspaces

---

## 🎨 Milestones Completed

1. ✅ Turborepo monorepo setup
2. ✅ Secure proxy API with origin validation
3. ✅ Streaming chat UI with shadcn components
4. ✅ Embeddable widget script
5. ✅ Dynamic model escalation (grok-beta → grok-4-1)
6. ✅ Structured trace logging
7. ✅ Admin dashboard with AI grading
8. ✅ Interactive tools (ticket creation modal)

---

## 📄 License

MIT — Built for xAI interview demonstration.
