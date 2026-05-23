# Deploy Checklist

## Pre-Deploy

- [ ] All env vars set in Vercel dashboard
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_APP_URL`
  - `GEMINI_API_KEY` (optional)
  - `OPENAI_API_KEY` (optional)
  - `RESEND_API_KEY` (optional)
- [ ] Supabase migration run (`schema.sql` executed in SQL Editor)
- [ ] Storage bucket "receipts" created and set to private
- [ ] Auth providers configured (Email magic link + Google OAuth)
- [ ] `npm run build` succeeds locally with zero errors
- [ ] `npm run lint` passes with zero warnings

## Deploy

- [ ] Code pushed to GitHub
- [ ] Repo connected to Vercel project
- [ ] Environment variables copied from `.env.local` to Vercel dashboard
- [ ] Build settings: Framework = Next.js, Root Directory = `./`
- [ ] Deploy succeeds (green checkmark on Vercel dashboard)

## Post-Deploy Verification

- [ ] Homepage loads at production URL (no 500/404 errors)
- [ ] Sign-in with magic link works end-to-end (email -> click link -> dashboard)
- [ ] Sign-in with Google OAuth works (if configured)
- [ ] Upload a receipt (image or PDF) successfully
- [ ] AI extraction runs and returns structured data (if API keys configured)
- [ ] Review queue displays the pending transaction with extracted fields
- [ ] Approve flow: transaction moves to ledger and disappears from review queue
- [ ] Reject flow: transaction is removed from review queue
- [ ] Transaction appears in the ledger with correct data
- [ ] Dashboard shows KPI cards (revenue, expenses, tax estimate) with real data
- [ ] Subscription list loads and displays correctly
- [ ] Tax Position page shows monthly forecast and annual projection
- [ ] Settings page saves changes and persists after refresh
- [ ] Full end-to-end: upload -> review -> approve -> ledger -> dashboard (one continuous flow)
- [ ] All 12 modules functional:
  1. [ ] Authentication (sign-in / sign-out)
  2. [ ] Receipt Upload
  3. [ ] AI Extraction
  4. [ ] Review Queue
  5. [ ] Transaction Ledger
  6. [ ] Dashboard / KPIs
  7. [ ] Subscription Tracker
  8. [ ] Tax Position
  9. [ ] Month-End Close
  10. [ ] Reports & Charts
  11. [ ] Data Export
  12. [ ] Settings
