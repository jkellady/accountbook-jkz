# JK Zentra Finance Cockpit

> **Smart receipt tracking and tax management for Malaysian sole proprietors**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Local Development Setup](#5-local-development-setup)
6. [Supabase Setup](#6-supabase-setup)
7. [Environment Variables](#7-environment-variables)
8. [Deploy to Vercel](#8-deploy-to-vercel)
9. [Post-Deploy Checklist](#9-post-deploy-checklist)
10. [Architecture Decisions](#10-architecture-decisions)
11. [Monthly Running Cost](#11-monthly-running-cost)
12. [Contributing / Development Notes](#12-contributing--development-notes)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Overview

JK Zentra Finance Cockpit is a founder-first finance management application built specifically for Malaysian sole proprietors who need to track receipts, manage subscriptions, and stay on top of their tax position without the overhead of a full accounting system.

**This is NOT an accounting system. This is NOT an ERP.** It is a finance cockpit — designed for the founder who needs to capture receipts on the go, review AI-extracted data in the evening, and file taxes confidently at year-end. Every feature is built around the daily workflow of a busy sole proprietor: capture receipts from Grab rides and client dinners, track software subscriptions (SaaS tools, domain renewals, cloud hosting), and maintain a clear picture of cash flow and tax obligations without double-entry bookkeeping.

The app bridges the gap between a shoebox full of paper receipts and a formal accounting ledger. AI-powered receipt extraction reads Malaysian GST invoices, Grab e-receipts, and handwritten notes, converting them into structured transaction records. Every extraction goes through a human review queue — the AI suggests, you approve. This means you get the speed of automation with the accuracy of human judgment, which is critical when the tax authority comes knocking.

Key features include AI receipt extraction (Gemini 2.5 Flash with GPT-4o-mini fallback), subscription tracking with renewal reminders, a real-time tax position dashboard that projects your annual tax obligation, month-end close workflows, and a full transaction ledger with export capability. The entire application is built on Supabase with Row Level Security, so your financial data stays private to your account from day one.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (magic link + Google) |
| Storage | Supabase Storage |
| AI/OCR | Gemini 2.5 Flash + GPT-4o-mini fallback |
| Email | Resend |
| Hosting | Vercel |

---

## 3. Project Structure

```
app/                        — Next.js App Router pages
  (auth)/                   — Auth route group (sign-in, callback)
  (dashboard)/              — Protected dashboard route group
    dashboard/              — KPI dashboard
    upload/                 — Receipt upload + AI extraction
    review/                 — Review queue (approve/reject)
    ledger/                 — Transaction ledger
    subscriptions/          — Subscription tracker
    tax-position/           — Tax forecast & estimations
    month-end/              — Month-end close workflow
    settings/               — User settings
    reports/                — Financial reports & charts
    export/                 — Data export tools
components/                 — React components (by feature)
  ui/                       — shadcn/ui base components
  dashboard/                — Dashboard-specific components
  receipt/                  — Receipt upload & review components
  transactions/             — Ledger & transaction components
  subscriptions/            — Subscription management components
  tax/                      — Tax position components
lib/
  actions/                  — Server actions (CRUD operations)
  ai/                       — AI extraction pipeline
  supabase/                 — Supabase clients + types
  utils/                    — Utility functions
  config/                   — Navigation config
  validation/               — Zod schemas
hooks/                      — Custom React hooks
  use-auth.ts               — Auth state management
  use-transactions.ts       — Transaction data hooks
  use-receipt-upload.ts     — Receipt upload hook
  use-subscriptions.ts      — Subscription data hooks
  use-dashboard-kpis.ts     — Dashboard KPI calculation
types.ts                    — Global TypeScript types
schema.sql                  — Database schema (run in Supabase)
database.types.ts           — Generated Supabase types
public/                     — Static assets
```

---

## 4. Prerequisites

Before you begin, ensure you have the following:

- **Node.js 18+** — Download from [nodejs.org](https://nodejs.org/)
- **npm or yarn** — Comes bundled with Node.js
- **A Supabase project** — Sign up free at [supabase.com](https://supabase.com/)
- **A Vercel account** — Sign up free at [vercel.com](https://vercel.com/)
- **(Optional) Gemini API key** — Get from [Google AI Studio](https://aistudio.google.com/) for AI receipt extraction
- **(Optional) Resend API key** — Get from [resend.com](https://resend.com/) for email reminders

---

## 5. Local Development Setup

### Step 1: Clone the repository

```bash
git clone <repo-url>
cd jk-zentra-finance
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials. See the [Environment Variables](#7-environment-variables) section for the full list.

### Step 4: Run database migrations

1. Go to the [Supabase Dashboard](https://app.supabase.com/) for your project.
2. Navigate to **SQL Editor** -> **New Query**.
3. Paste the contents of `schema.sql`.
4. Click **Run**.

### Step 5: Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Supabase Setup

### 6.1 Create a project

1. Go to [supabase.com](https://supabase.com/) and sign up/sign in.
2. Click **New Project**.
3. Give it a name (e.g., `zentra-finance`).
4. Choose a region (closest to your users — `Southeast Asia (Singapore)` for Malaysia).
5. Wait for the project to provision (~2 minutes).

### 6.2 Run the database schema

1. In your project dashboard, go to **SQL Editor**.
2. Click **New Query**.
3. Open the `schema.sql` file from this repo and copy its entire contents.
4. Paste into the SQL Editor and click **Run**.
5. Verify the tables were created under **Table Editor**.

### 6.3 Create the storage bucket

1. Go to **Storage** in the left sidebar.
2. Click **New Bucket**.
3. Name: `receipts`
4. Uncheck **Public bucket** (must be **private**).
5. Click **Save**.

### 6.4 Configure authentication

1. Go to **Authentication** -> **Providers**.
2. Under **Email**, make sure it is **Enabled**. Disable **Confirm Email** (we use magic links).
3. Under **Google OAuth**, enable it and add your Google OAuth credentials (optional).
4. Under **URL Configuration**, set the Site URL to your production URL (or `http://localhost:3000` for local).

### 6.5 Copy credentials

1. Go to **Project Settings** -> **API**.
2. Copy **Project URL** -> paste into `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy **anon public** key -> paste into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Copy **service_role secret** key -> paste into `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — never expose to the client).

---

## 7. Environment Variables

Create a `.env.local` file in the project root with the following variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL (from Project Settings -> API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only — never expose) |
| `GEMINI_API_KEY` | No | Google Gemini API key for AI receipt extraction |
| `OPENAI_API_KEY` | No | OpenAI API key (fallback for AI extraction) |
| `RESEND_API_KEY` | No | Resend API key for sending email reminders |
| `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` for development, your production URL for deploy |

### Example `.env.local` file

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# AI / OCR (optional but recommended)
GEMINI_API_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-...

# Email (optional)
RESEND_API_KEY=re_...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 8. Deploy to Vercel

### Option A: Deploy with Vercel CLI

```bash
# 1. Install Vercel CLI globally
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy (from project root)
vercel --prod
```

### Option B: Connect GitHub for auto-deploys (recommended)

1. Push your code to a GitHub repository.
2. Go to [vercel.com](https://vercel.com/) and click **Add New Project**.
3. Import your GitHub repository.
4. Set the **Framework Preset** to **Next.js**.
5. Under **Environment Variables**, add all variables from `.env.local`.
6. Click **Deploy**.
7. On every `git push` to `main`, Vercel will auto-deploy.

### After deployment

1. Copy your production URL (e.g., `https://jk-zentra.vercel.app`).
2. Go to **Supabase Dashboard** -> **Authentication** -> **URL Configuration**.
3. Set **Site URL** to your production URL.
4. Add your production URL to **Redirect URLs**.

---

## 9. Post-Deploy Checklist

Use this checklist to verify your deployment is fully functional:

- [ ] **App loads** at Vercel URL (no 500 errors)
- [ ] **Sign-in with magic link** works — email arrives, link redirects correctly
- [ ] **Upload a test receipt** — drag-and-drop or file picker succeeds
- [ ] **AI extraction processes** the file — spinner runs, results appear
- [ ] **Review queue** shows the pending transaction with extracted fields
- [ ] **Approve/reject workflow** works — approving moves to ledger, rejecting deletes
- [ ] **Transaction appears in ledger** — data table shows the approved transaction
- [ ] **Dashboard shows KPIs** — revenue, expenses, tax estimate populate
- [ ] **Subscription list loads** — existing subscriptions display
- [ ] **Tax Position shows forecast** — monthly and annual projections render
- [ ] **Settings page saves** — user profile and preferences persist after refresh

---

## 10. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Cash basis accounting** | Sole proprietors in Malaysia report on cash basis. No accrual, no accounts payable/receivable. |
| **Integer minor units** | All monetary amounts stored as integers (sen/cents). Never use floating-point for money. `15000` = RM 150.00. |
| **Never auto-approve AI extractions** | Every AI-extracted transaction requires human approval. Prevents garbage data from entering the ledger. |
| **Soft delete only** | Records are never hard-deleted. Set `status = 'archived'` instead. Audit trail is preserved forever. |
| **Row Level Security (RLS) from day one** | Every database table has RLS policies. Users can only read/write their own data. |
| **Mobile-first for capture, desktop for review** | Upload and quick capture work great on mobile. Review, reporting, and tax analysis are desktop-optimized. |

---

## 11. Monthly Running Cost

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | Free |
| Supabase | Free | Free (upgrade when you exceed 500MB database or 1GB storage) |
| Gemini API | Pay-as-you-go | ~$1-3/month (typical sole proprietor volume) |
| Resend | Free | Free (3,000 emails/month) |
| **Total** | | **~$2-4/month** |

*Note: These are true hobbyist costs. At scale (1000+ transactions/month), expect ~$10-15/month total.*

---

## 12. Contributing / Development Notes

- Run `npm run lint` before every commit. CI will fail on lint errors.
- **All monetary amounts are integer minor units** (sen/cents). Never use floats. `10000` = RM 100.00.
- **Currency is required on every transaction.** All money fields must include a `currency` column.
- Read `schema.sql` and `database.types.ts` before adding new columns to any table.
- **Never invent columns** — if a field you need doesn't exist in the schema, flag the conflict instead of adding it ad-hoc.
- Server actions live in `lib/actions/`. One file per domain (`transactions.ts`, `subscriptions.ts`, etc.).
- All AI extraction logic lives in `lib/ai/`.
- Keep components in `components/` organized by feature. Reusable UI primitives go in `components/ui/`.

---

## 13. Troubleshooting

### `Error: Invalid Supabase URL`
- **Cause:** `NEXT_PUBLIC_SUPABASE_URL` is missing or malformed.
- **Fix:** Check your `.env.local` file. URL should be `https://your-project-ref.supabase.co` with no trailing slash.

### `401 Unauthorized` on API calls
- **Cause:** Supabase anon key is incorrect, expired, or the row-level security policy is blocking access.
- **Fix:** Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your `.env.local`. Check RLS policies in Supabase SQL Editor with `SELECT * FROM pg_policies WHERE schemaname = 'public';`.

### `500 Internal Server Error` on upload
- **Cause:** The `receipts` storage bucket doesn't exist, isn't private, or the user doesn't have upload permissions.
- **Fix:** Go to Supabase Dashboard -> Storage. Ensure a bucket named `receipts` exists and is set to **private**. Re-run `schema.sql` to ensure RLS policies are applied.

### AI extraction returns empty/invalid data
- **Cause:** `GEMINI_API_KEY` or `OPENAI_API_KEY` is missing, invalid, or rate-limited.
- **Fix:** Check your API key is valid. The app falls back to OpenAI if Gemini fails. Without either key, the extraction step will show an error. The rest of the app works without AI — you can enter transactions manually.

### `next build` fails with TypeScript errors
- **Cause:** Type mismatches between generated types and code.
- **Fix:** Run `npm run lint` to see detailed errors. Ensure `database.types.ts` matches the current `schema.sql`. Regenerate types with `npx supabase gen types typescript --project-id <your-project-id> --schema public > lib/supabase/database.types.ts` if needed.

### Email magic links not arriving
- **Cause:** Supabase email provider isn't configured, or emails are landing in spam.
- **Fix:** Check Supabase Auth -> Email settings. For production, configure a custom SMTP provider (Resend, SendGrid) in Supabase settings. Check spam/junk folders.

### Cron job for reminders not firing
- **Cause:** Cron jobs only work on Vercel Pro tier (Hobby tier does not support cron jobs).
- **Fix:** Upgrade to Vercel Pro ($20/mo) or set up an external cron service (e.g., [cron-job.org](https://cron-job.org/)) to ping `/api/cron/reminders` on a schedule.

---

*Built with care for Malaysian sole proprietors. Questions? Open an issue on the repository.*
