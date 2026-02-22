# HealthLink

A React Native (Expo) health management app with a FastAPI backend, Supabase database, and AI-powered chat.

---

## 📁 Project Structure

```
health_link/
├── MyNewApp/          # Expo React Native frontend
│   ├── src/
│   │   ├── config/host.ts      # ← Backend API URL lives here
│   │   ├── screens/            # All app screens
│   │   ├── components/         # Reusable UI components
│   │   ├── theme/              # Design tokens & colors
│   │   └── navigation/         # Tab & stack navigation
│   ├── eas.json                # EAS Build/Update config
│   └── app.json                # Expo project config
│
└── backend/           # FastAPI Python backend
    ├── backend.py              # API routes & logic
    ├── main.py                 # Entry point (uvicorn)
    ├── .env.local              # Secrets (Supabase, Twilio)
    └── requirements.txt        # Python dependencies
```

---

## 🚀 Quick Start (Local Dev)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Backend runs on `http://localhost:9000`.

### 2. Frontend

```bash
cd MyNewApp
npm install
npx expo start --lan
```

Scan the QR code with **Expo Go** (same WiFi network required).

---

## 🌐 Tunneling Guide (Share Over the Internet)

You need **two separate tunnels** — one for the backend API, one for the Expo frontend.

| Tunnel | Tool | Port | Purpose |
|--------|------|------|---------|
| Backend API | **Cloudflared** | 9000 | Login, chat, upload, QR, etc. |
| Expo Frontend | **Expo Tunnel** or **EAS Update** | 8081 | Delivers the JS bundle to phones |

### Step 1: Start the Backend

```bash
cd backend
python main.py
```

### Step 2: Tunnel the Backend (Cloudflared)

Open a **new terminal**:

```bash
npx -y cloudflared tunnel --url http://localhost:9000
```

You'll see output like:

```
Your quick Tunnel has been created! Visit it at:
https://something-random.trycloudflare.com
```

**Copy that URL** — you'll need it in the next step.

> ⚡ Cloudflare tunnels are free, no account needed.
> ⚠️ URL changes every time you restart cloudflared.

### Step 3: Update the Frontend Config

Edit `MyNewApp/src/config/host.ts`:

```typescript
export const BASE_URL = "https://something-random.trycloudflare.com";
```

Replace with the URL from Step 2.

### Step 4: Share the Frontend

You have **two options**:

---

#### Option A: EAS Update (Recommended for remote friends)

Friends only need **Expo Go** installed. No same-WiFi requirement.

**First-time setup** (already done if you followed earlier):
```bash
cd MyNewApp
npm install -g eas-cli
npx expo login          # Log into your Expo account
eas init                 # Link project to EAS
npx expo install expo-updates
```

**Publish the app:**
```bash
eas update --branch default --message "your update message"
```

**Share with your friend:**
1. Friend installs **Expo Go** from Play Store / App Store
2. Friend opens this link:
   ```
   https://expo.dev/@agiless/MyNewApp
   ```
3. App loads in Expo Go!

**After making code changes**, re-publish:
```bash
eas update --branch default --message "describe changes"
```

---

#### Option B: Expo LAN Mode (Same WiFi only)

If your friend is on the **same WiFi network**:

```bash
cd MyNewApp
npx expo start --lan
```

Friend scans the terminal QR code with Expo Go. That's it.

---

## 📋 Full Startup Checklist (Remote Sharing)

Run these in **3 separate terminals**:

```
┌─────────────────────────────────────────────────────────────┐
│ Terminal 1: Backend Server                                  │
│ > cd backend                                                │
│ > python main.py                                            │
│                                                             │
│ Terminal 2: Backend Tunnel (Cloudflared)                     │
│ > npx -y cloudflared tunnel --url http://localhost:9000      │
│ → Copy the https://...trycloudflare.com URL                 │
│ → Paste into MyNewApp/src/config/host.ts                    │
│                                                             │
│ Terminal 3: Frontend                                        │
│ > cd MyNewApp                                               │
│ > eas update --branch default --message "publish"           │
│   (for remote friends)                                      │
│   OR                                                        │
│ > npx expo start --lan                                      │
│   (for same-WiFi testing)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Environment Variables

Backend secrets are stored in `backend/.env.local`:

```env
TWILIO_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native, Expo SDK 54, Expo Router |
| Styling | Custom dark theme, Ionicons, LinearGradient |
| Backend | Python, FastAPI, Uvicorn |
| Database | Supabase (PostgreSQL) |
| Auth | bcrypt password hashing, OTP via Twilio |
| Tunneling | Cloudflared (backend), EAS Update (frontend) |

---

## ⚠️ Common Issues

| Problem | Fix |
|---------|-----|
| `expo --tunnel` fails with "remote gone away" | Use **EAS Update** or **LAN mode** instead — `@expo/ngrok` has compatibility issues |
| Friend can't reach API | Make sure cloudflared tunnel is running and `host.ts` has the correct URL |
| Cloudflared URL changed | Restart cloudflared → copy new URL → update `host.ts` → re-publish with `eas update` |
| Free ngrok conflicts | Don't use ngrok for backend if Expo tunnel is also using ngrok — use cloudflared instead |