# TestTrail

**A calmer way to test Solana dApps.** Create a test run, share a short link, collect useful tester feedback, and optionally publish a verifiable receipt on Solana Devnet.

## Features

- Responsive testing workspace inspired by the AgentLab reference and Apple's design principles.
- Create test runs and share `/t/<slug>` links; use `/i/<slug>` for the report inbox.
- Passed, failed, and blocked report statuses, optional notes, and screenshot attachments.
- Optional wallet-signed Solana Devnet Memo receipt, with Explorer links.
- Supabase-backed runs, reports, and screenshot storage when configured.
- Local demo mode when Supabase isn't configured. Demo data is not persistent.

## Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Never put a Supabase service-role key in browser code.

## Configure Supabase

1. Open the Supabase SQL editor and run `supabase/schema.sql`.
2. If screenshot uploads are needed, run `supabase/storage.sql`.
3. Set the Supabase project URL and anon key in your local environment or Vercel project settings.
4. Redeploy after setting environment variables.

The included SQL policies are intentionally permissive for a public demo. Before production use, add authenticated project ownership, restrict report creation, apply rate limits, and review screenshot privacy and retention. Anyone with access to the public screenshot bucket can view uploaded images.

## Test receipts

Receipts use the Solana Devnet Memo program. The connected wallet is asked to sign a transaction only when the tester enables the receipt option and submits the report. The wallet may charge a Devnet transaction fee. A confirmed memo proves that a message was submitted on-chain; it does not prove the dApp itself is secure or correct. Never enter or share a seed phrase or private key.

## Deployment

The included `vercel.json` rewrites client-side routes to the Vite entry point. Connect the repository to Vercel, configure the environment variables, and deploy.
