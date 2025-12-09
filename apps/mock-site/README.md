This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Mock-Site Demo: Embed Chat Widget Tester

This app simulates a customer website embedding the Grok-powered chat widget from `../chatbot`.

### Quick Start
1. **Workspace Install**: From root `pnpm i` (PNPM monorepo).
2. **Dev**: `pnpm --filter mock-site dev` (port 3000) or root `pnpm turbo run dev --parallel`.
3. **Test Embed**: Visit http://localhost:3000 – See demo homepage with bottom-right bubble. Click to toggle widget (loads from chatbot:3001/widget.js).
   - Interact: Chat streams via proxy; verify customerId passed, origin secure.
   - Inspect: Network tab shows no key leaks; console for model routing logs.
4. **Customize**: Edit `app/page.tsx` for site content; update `<script src>` for prod chatbot URL.
5. **Build**: `pnpm --filter mock-site build`.

### Role in Project
- Demonstrates embed script (`widget.js` from chatbot public/) in real site.
- Supports iframe-resizer for dynamic height (add CDN/JS if needed).
- Tests cross-app flow: Embed → widget mount → API proxy → xAI stream.

See root README/@overview.md for full setup, milestones, tests. For prod: Deploy independently, update script src.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
