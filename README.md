# TestTrail

A calm, precise testing workspace for Solana dApps. Create test runs, collect tester reports and screenshots, and verify on-chain receipts on Solana Devnet.

## Stack

- Vite + React
- Supabase for persistent projects, reports, and short links (configure environment variables)
- Solana wallet-adapter compatible wallet connection
- Solana Devnet memo receipts

## Setup

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and add your Supabase project URL and anon key. Without Supabase configured, the UI runs in local demo mode and clearly labels demo data.

## Supabase

Apply `supabase/schema.sql` in the Supabase SQL editor. Keep Row Level Security enabled. Never put a service-role key in browser code.

## Receipts

Receipts are submitted as memo transactions on Solana Devnet. A successful signature proves that the receipt was submitted, not that the tested application is secure or correct.
