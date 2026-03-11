# Vercel Deployment Guide - Habit Cracker

Deploy your Habit Cracker app (Next.js, MongoDB, Firebase push) to Vercel.

---

## Prerequisites

- **GitHub** (or GitLab/Bitbucket) account  
- **Vercel** account (free tier works)  
- **MongoDB Atlas** (or any MongoDB connection string)  
- **Firebase** project (for push notifications)

---

## 1. Prepare the project

### 1.1 Test build locally

```bash
npm run build
```

Fix any errors before deploying.

### 1.2 Commit and push to GitHub

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### 1.3 `.gitignore`

Ensure these are ignored (they should already be):

```
node_modules/
.env
.env*.local
.next/
.vercel/
firebase-service-account.json
*-firebase-adminsdk-*.json
```

---

## 2. MongoDB Atlas (if needed)

1. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) → create cluster (e.g. M0 free).
2. **Database Access** → Add user (username + password).
3. **Network Access** → **Allow Access from Anywhere** (or add Vercel IPs).
4. **Database** → **Connect** → **Connect your application** → copy URI.
5. Replace `<password>` and add database name:  
   `mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/habit-cracker?retryWrites=true&w=majority`

---

## 3. Deploy on Vercel

### 3.1 Import project

1. [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. Import your GitHub repo.
3. Framework: **Next.js** (auto-detected).

### 3.2 Environment variables

In the project → **Settings** → **Environment Variables**, add these for **Production** (and Preview/Development if you use them).

#### Required (app + auth + DB)

| Name | Value | Notes |
|------|--------|--------|
| `MONGODB_URI` | `mongodb+srv://...` | From MongoDB Atlas |
| `JWT_SECRET` | long random string | e.g. `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | different long random string | |

#### Required for push notifications (FCM)

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | from Firebase Console | Project Settings → General |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | numeric sender ID | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | e.g. `1:xxx:web:xxx` | |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web Push key | Cloud Messaging → Web Push certificates |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **single-line JSON** | See below |
| `CRON_SECRET` | long random string | For cron endpoint auth |

#### Optional

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Used for notification click link (defaults to `/dashboard`) |
| `NODE_ENV` | `production` | Usually set by Vercel |

**Firebase service account on Vercel (no file):**

- In Firebase: **Project Settings** → **Service accounts** → **Generate new private key**.
- You get a JSON file. On Vercel you **cannot** use a file; use the env var **`FIREBASE_SERVICE_ACCOUNT_JSON`**.
- Minify the JSON to **one line** (no line breaks), then paste as the value of `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Keep the `\n` inside the `private_key` string as the two characters `\` and `n` (escaped newlines).

Example (conceptually; use your real key):

```json
{"type":"service_account","project_id":"habit-cracker","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxx@habit-cracker.iam.gserviceaccount.com",...}
```

### 3.3 Deploy

Click **Deploy**. Wait for the build to finish.

---

## 4. Cron job (push notifications)

The repo includes **`vercel.json`** so that Vercel runs the notification trigger every 5 minutes:

- **Path:** `/api/notifications/trigger`
- **Schedule:** `*/5 * * * *` (every 5 minutes)

For this to be **authorized**, set **`CRON_SECRET`** in Vercel. Vercel Cron sends:

`Authorization: Bearer <CRON_SECRET>`

The trigger route accepts that header (and also `?secret=` or `x-cron-secret` if you call it from an external cron).

- **Vercel plan:** Cron jobs are available on **Pro**. On **Hobby**, the cron entry may be ignored; use an external cron (e.g. [cron-job.org](https://cron-job.org)) to call:
  `GET https://your-app.vercel.app/api/notifications/trigger?secret=YOUR_CRON_SECRET`  
  every 5 minutes.

---

## 5. After deployment

### 5.1 Check

- Open `https://your-project.vercel.app`.
- Sign up / log in, create a habit, use the app.
- In Vercel: **Functions** (or **Logs**) for runtime errors.

### 5.2 Optional: custom domain

- **Settings** → **Domains** → add your domain and follow DNS instructions.

### 5.3 Optional: app URL for notifications

If you use a custom domain, set:

`NEXT_PUBLIC_APP_URL=https://yourdomain.com`

so notification clicks open the right URL.

---

## 6. Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Access token secret |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token secret |
| `NEXT_PUBLIC_FIREBASE_*` | ✅ for FCM | Firebase client config + VAPID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅ for FCM | One-line JSON key (Vercel) |
| `CRON_SECRET` | ✅ for cron | Secret for `/api/notifications/trigger` |
| `NEXT_PUBLIC_APP_URL` | Optional | Production URL for notification links |
| `NODE_ENV` | Optional | Set to `production` by Vercel |

---

## 7. Troubleshooting

**Build fails**

- Run `npm run build` locally and fix TypeScript/compile errors.
- Ensure all env vars above are set for the environment you deploy (e.g. Production).

**MongoDB connection error**

- Check `MONGODB_URI` (password, database name, no spaces).
- Atlas **Network Access**: allow `0.0.0.0/0` or add Vercel IPs if required.

**Push notifications not sent**

- Confirm all `NEXT_PUBLIC_FIREBASE_*` and `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel.
- Ensure `CRON_SECRET` is set and cron is running (Vercel Pro or external cron).
- Check **Vercel** → **Functions** / **Logs** for errors from `/api/notifications/trigger`.

**Cookies / auth not working**

- Use HTTPS (Vercel provides it).
- If you use a custom domain, set it in **Domains** and optionally in `NEXT_PUBLIC_APP_URL`.

---

## 8. Deploy via Vercel CLI (alternative)

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

Add the same environment variables in the Vercel dashboard (or via CLI) before or after linking.

---

**Quick checklist**

- [ ] Code pushed to GitHub  
- [ ] Project imported in Vercel  
- [ ] All env vars set (including `FIREBASE_SERVICE_ACCOUNT_JSON` as one-line JSON and `CRON_SECRET`)  
- [ ] Build succeeds  
- [ ] Login/signup and main flows work  
- [ ] Cron configured (Pro or external) if you use push notifications  
