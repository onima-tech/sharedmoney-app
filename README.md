# SharedMoney

Track and settle shared expenses with friends, roommates, or groups. Split bills, manage balances, and settle up efficiently—no more awkward money conversations. **[Try SharedMoney →](https://sharedmoney.app)**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com)
[![React Native](https://img.shields.io/badge/React%20Native-61DAFB?style=flat&logo=react&logoColor=black)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-000020?style=flat&logo=expo&logoColor=white)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org)

## Screenshots

<div align="center">
  <img src="mobile/screenshots/Screenshot_1767700176.png" alt="SharedMoney app screenshot 1" width="300" />
  <img src="mobile/screenshots/Screenshot_1767700183.png" alt="SharedMoney app screenshot 2" width="300" />
</div>

---

## Component Overview

| Component | Technology | Purpose |
| --------- | ---------- | ------- |
| **Mobile App** | React Native (Expo) | iOS and Android native experience |
| **Web App** | Expo Web | Browser-based access via Expo |
| **Landing Page** | React + Vite | Marketing/onboarding site |
| **Edge Functions** | Supabase Edge Functions (Deno) | API endpoints and business logic |
| **Database** | Supabase (PostgreSQL) | Data storage with Row Level Security |
| **Authentication** | Supabase Auth | Email/password and OAuth |

---

## 📋 Setup Instructions

**Prerequisites**
1. **Node.js** (v18+)
2. **Docker** (for local Supabase development)
3. **Supabase CLI** (for local development)
4. **Supabase account** (for production deployment)

### Step 1: Clone and Install

```bash
git clone <repository-url>
cd SharedMoney
npm install
```

This project uses npm workspaces, so a single `npm install` installs dependencies for all workspaces (root and mobile).

### Step 2: Start Local Supabase

```bash
# Start local Supabase (requires Docker)
supabase start

# Check status
supabase status
```

**Connection Details:**
- API URL: `http://127.0.0.1:54321`
- Database URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio URL: `http://127.0.0.1:54323` (Supabase Dashboard)

### Step 3: Configure Environment Variables

Create `.env` in the root directory:

```env
# For Local Development
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# CORS Configuration for Edge Functions
ALLOWED_ORIGIN=http://localhost:19000
```

Create `mobile/.env` (must use `EXPO_PUBLIC_` prefix):

```env
# For iOS Simulator
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=http://localhost:8888/api

# For Android Emulator (uncomment and comment iOS settings above)
# EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321
# EXPO_PUBLIC_API_URL=http://10.0.2.2:8888/api
```

See `TECH.md` for full variants (simulator, emulator, physical device, production).

### Step 4: Run the Application

```bash
# Terminal 1 - Supabase Edge Functions (local)
npm run dev:server
# Functions available at http://localhost:54321/functions/v1/

# Terminal 2 - Mobile app (Expo)
npm run dev:mobile
# Opens Expo Dev Tools / QR code for device scanning

# Terminal 3 - Web client (optional)
npm run dev:web
```

**Note:** Make sure local Supabase is running (`supabase start`) before starting the Edge Functions server.

### Step 5: Test Database Seed

The `supabase/seed.sql` file automatically runs when you reset your database:

```bash
npx supabase db reset --local
```

This creates:
- **4 test users** (alice@test.com, bob@test.com, charlie@test.com, diana@test.com)
  - Password for all: `testpassword123`
- **2 test groups** with members
- **5 transactions** with expense splits
- **2 settlements** between users

**Note:** You may see a 502 error at the end—this is harmless. The seed data is inserted successfully. The error is a timing issue with container health checks during restart.

The seed can be run repeatedly—it uses `ON CONFLICT DO NOTHING` to safely re-run without duplicates.

---

## 📁 Project Structure

```
SharedMoney/
├── supabase/
│   ├── functions/        # Supabase Edge Functions
│   ├── migrations/       # Database migrations
│   └── seed.sql          # Test data seed
├── mobile/               # React Native Expo app
│   ├── components/       # React components
│   ├── screens/          # App screens
│   ├── hooks/            # React hooks
│   └── utils/            # Utilities
├── web/                  # Landing page (Vite/React)
├── docs/                 # Hosted static pages
└── .github/workflows/    # CI/CD workflows
```

---

## ⚙️ Configuration

### Environment Variables

**Root `.env`** (for local development):

| Variable | Purpose | Example |
| -------- | ------- | ------- |
| `SUPABASE_URL` | Supabase API URL | `http://127.0.0.1:54321` |
| `SUPABASE_ANON_KEY` | Public anon key | (from `supabase status`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | (from `supabase status`) |
| `ALLOWED_ORIGIN` | CORS origin for Edge Functions | `http://localhost:19000` |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Google Web OAuth client ID from the `sharedmoney-504507` Google Cloud project for local Supabase Auth | `...apps.googleusercontent.com` |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` | Google Web OAuth client secret for local Supabase Auth | `GOCSPX-...` |
| `APP_URL` | App URL used in reminder email links | `https://sharedmoney.app/app` |
| `REMINDER_CRON_SECRET` | Shared secret required to invoke monthly reminders | random secret |
| `NOTIFICATION_WORKER_SECRET` | Shared secret required to invoke the push notification worker | random secret |
| `POSTHOG_PROJECT_TOKEN` | Public PostHog project token used for server-authoritative notification flag evaluation | `phc_...` |
| `POSTHOG_HOST` | PostHog ingestion host used by the flags API | `https://us.i.posthog.com` |
| `EXPO_ACCESS_TOKEN` | Optional Expo access token for enhanced push security | Expo access token |
| `RESEND_API_KEY` | Resend API key for reminder emails | `re_...` |
| `REMINDER_FROM_EMAIL` | Verified sender for reminder emails | `SharedMoney <reminders@sharedmoney.app>` |
| `REMINDER_LOGO_URL` | Optional hosted logo URL for reminder emails; falls back to `${APP_URL}/icon.png` | `https://yourdomain.com/icon.png` |

Generated invite, group, and reminder links should always use
`https://sharedmoney.app/app`. The Expo redirect workflow and its artifact
have been removed from this repo.

**Supabase Vault secrets for monthly reminders:**

| Secret | Purpose |
| ------ | ------- |
| `monthly_reminders_function_url` | Full deployed function URL, e.g. `https://<project-ref>.supabase.co/functions/v1/monthly-reminders` |
| `monthly_reminders_cron_secret` | Same value as `REMINDER_CRON_SECRET` |

**Supabase Vault secrets for transaction notifications:**

| Secret | Purpose |
| ------ | ------- |
| `notification_worker_function_url` | Full deployed function URL, e.g. `https://<project-ref>.supabase.co/functions/v1/notification-worker` |
| `notification_worker_secret` | Same value as the Edge Function `NOTIFICATION_WORKER_SECRET` |

Apply the notification migration before deploying the functions. The migration
schedules the worker every minute when `pg_cron` and `pg_net` are available; it
also performs a best-effort immediate wake-up for new outbox rows and safely
falls back to cron until both Vault secrets above exist. Native push
notifications require an Expo development or production build rather than Expo Go.
The `transaction-notifications` PostHog flag in the dedicated `SharedMoney`
organization and `SharedMoney Production` project controls inbox access,
transaction fan-out, and push delivery. Missing or unavailable flag
configuration fails closed.

**Mobile `mobile/.env`** (Expo requires `EXPO_PUBLIC_` prefix):

| Variable | Purpose | Example |
| -------- | ------- | ------- |
| `EXPO_PUBLIC_SUPABASE_URL` | API URL | `http://127.0.0.1:54321` (iOS) or `http://10.0.2.2:54321` (Android) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | (from `supabase status`) |
| `EXPO_PUBLIC_API_URL` | Edge Functions base | `http://localhost:8888/api` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google Web OAuth client ID used by Supabase Google auth and Android native Google Sign-In | `...apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` | Optional reversed iOS Google client ID (`com.googleusercontent.apps…`) if enabling native Google on iOS later | `com.googleusercontent.apps.…` |

For Android emulator Google sign-in against local Supabase, use the `sharedmoney-504507` Google Cloud project, add `http://127.0.0.1:54321/auth/v1/callback` as an Authorized redirect URI on the Google Web OAuth client, create an Android OAuth client for package `com.vaibhavarora.sharemoney` with your debug SHA-1, set the Google client ID/secret in `supabase/.env`, set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `mobile/.env`, restart Supabase with `supabase stop && supabase start`, then run `adb reverse tcp:54321 tcp:54321`. Native Google Sign-In requires an Expo development build (`expo run:android`), not Expo Go. Full steps: [`docs/GOOGLE_AUTH.md`](docs/GOOGLE_AUTH.md).

### Key Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev:server` | Serve Supabase Edge Functions locally |
| `npm run dev:mobile` | Start Expo dev server |
| `npm run dev:web` | Run landing page locally |
| `npm run bootstrap` | Install deps across workspaces |

---

## 🛠️ Local Development

### Access Points

- **Supabase Studio**: http://127.0.0.1:54323
- **Edge Functions**: http://localhost:54321/functions/v1/
- **Mobile App**: Expo Dev Tools (opens automatically)
- **Landing Page**: http://localhost:5173 (or port shown in terminal)
- **Web App**: Access via Expo (built from `mobile/` directory)

### Development Workflow

1. Start Supabase: `supabase start`
2. Run Edge Functions: `npm run dev:server`
3. Run mobile app: `npm run dev:mobile`
4. Make changes and see live updates

---

## 🐛 Troubleshooting

**Supabase fails to start**
- Ensure Docker is running
- Check Docker has enough resources allocated
- Retry: `supabase start`

**Seed reset shows 502 error**
- This is expected during container restart
- Data is still applied successfully
- Check Supabase Studio to verify data

**Expo cannot reach API**
- **Physical device**: Use your machine's local IP address
- **Android emulator**: Use `10.0.2.2` instead of `localhost`
- **iOS simulator**: Use `127.0.0.1` or `localhost`

**CORS errors**
- Confirm `ALLOWED_ORIGIN` in root `.env` matches Expo dev server URL
- Check Edge Functions logs for CORS rejection details

**Database connection issues**
- Verify Supabase is running: `supabase status`
- Check connection strings match `supabase status` output
- Ensure migrations are applied: `supabase migration list`

---

## 📄 Documentation & Community
 
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** – Development setup, testing, and contribution guide
- **[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)** – Community participation standards
- **[SECURITY.md](./SECURITY.md)** – Vulnerability reporting policy
- **[TECH.md](./TECH.md)** – Complete technical architecture, database design, and troubleshooting
- **[mobile/EXPO_PUBLISH.md](./mobile/EXPO_PUBLISH.md)** – Expo publishing and EAS build guide
- **Supabase migrations**: `supabase/migrations/`
- **GitHub Actions**: `.github/workflows/`
 
---
 
## 📄 License
 
GNU Affero General Public License v3.0 (AGPL-3.0) - see [LICENSE](./LICENSE) for details.
 
---
 
**Built with Supabase + React Native (Expo)**
