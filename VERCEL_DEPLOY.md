# Vercel Deployment Guide — Belarro V4

## Step 1: Create Supabase Tables

1. Go to: https://supabase.com/dashboard
2. Select project: **wbqzlxdyjdmbzifhsyil**
3. Click **SQL Editor** → **New Query**
4. Copy & paste entire content from `SUPABASE_SETUP.sql`
5. Click **Run**
6. Tables created ✓

## Step 2: Create GitHub Repository

1. Go to: https://github.com/new
2. Repository name: `belarro-v4`
3. Description: "Crop management admin for Belarro vertical farm"
4. Public or Private (recommend Private)
5. Do NOT initialize with README (we have one)
6. Create repository

## Step 3: Push Code to GitHub

```bash
cd "C:\Users\The boss\Downloads\Claude Code\belarro-v4"
git remote add origin https://github.com/YOUR_USERNAME/belarro-v4.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 4: Connect to Vercel

1. Go to: https://vercel.com
2. Click **New Project**
3. Select **Import Git Repository**
4. Search for `belarro-v4`
5. Click **Import**
6. Framework Preset: **Next.js** (auto-detected)
7. Click **Deploy** (if you want to deploy now, do that next)

## Step 5: Configure Environment Variables in Vercel

1. In Vercel project dashboard
2. Go to **Settings** → **Environment Variables**
3. Add these variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://wbqzlxdyjdmbzifhsyil.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicXpseGR5amRtYnppZmhzeWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzkyODQsImV4cCI6MjA5NzM1NTI4NH0.8CsCaUq59d74lvHEDJdhwVVuXJ0056fdGeOp9TlF4Ps

SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndicXpseGR5amRtYnppZmhzeWlsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTc3OTI4NCwiZXhwIjoyMDk3MzU1Mjg0fQ.8D3AqF8nrhzey4f2vrkKPv0jLU5s2w9M0TYxq4P3K7E
```

4. Click **Save**

## Step 6: Deploy

Option A: **Auto-Deploy** (recommended)
- Vercel auto-deploys on every push to `main`
- Your app is live at: `https://belarro-v4.vercel.app` (or custom domain)

Option B: **Manual Deploy**
- In Vercel dashboard, click **Deployments** → **Deploy**

## Step 7: Test Live App

1. Go to your Vercel URL
2. Should redirect to `/admin/crops`
3. Create a test crop
4. Check Supabase to verify data saved

## Monitoring

- **Vercel:** vercel.com → Project Dashboard
  - Deployments, analytics, logs
- **Supabase:** supabase.com → Project Dashboard
  - Tables, logs, query performance

## Custom Domain (Optional)

In Vercel Settings → Domains:
1. Add your domain
2. Update DNS records (Vercel will guide)
3. SSL auto-enabled

## Summary

- ✓ Tables created in Supabase
- ✓ Code pushed to GitHub
- ✓ Connected to Vercel
- ✓ Environment variables set
- ✓ Auto-deployed on push
- ✓ Live at Vercel URL

**Done!**
