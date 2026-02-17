# Quick Fix: Use localhost (No HTTPS needed!)

## ✅ Simple Solution

The Web Speech API works on `localhost` even without HTTPS! Just make sure you're accessing:

**`http://localhost:3000`** (NOT `http://127.0.0.1:3000`)

## Steps:

1. **Start your dev server normally:**
   ```bash
   npm run dev
   ```

2. **Access your app at:**
   ```
   http://localhost:3000
   ```

3. **The microphone should work!** 🎤

## Why this works:

- The Web Speech API allows microphone access on:
  - ✅ `https://` (any domain)
  - ✅ `http://localhost` (localhost only)
  - ❌ `http://127.0.0.1` (doesn't work)
  - ❌ `http://192.168.x.x` (doesn't work)

## If you still want HTTPS:

If you prefer HTTPS, you need to install mkcert with admin rights:

1. **Right-click PowerShell** → **"Run as Administrator"**
2. Run: `choco install mkcert`
3. Then run: `npm run setup:https`
4. Start server: `npm run dev:https`

But for now, just use `http://localhost:3000` - it should work! 🚀
