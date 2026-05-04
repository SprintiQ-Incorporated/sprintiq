# Local Development with QStash

QStash delivers messages to your worker endpoints via HTTP POST. In production, Vercel handles this automatically. For local development, you need a public URL that tunnels to your local server.

## Setup with ngrok

### 1. Install ngrok

```bash
# Windows (Chocolatey)
choco install ngrok

# Or download from https://ngrok.com/download
```

### 2. Authenticate (one-time)

```bash
ngrok config add-authtoken YOUR_NGROK_AUTH_TOKEN
```

### 3. Start the tunnel

```bash
# In one terminal, run your dev server
npm run dev

# In another terminal, start the tunnel
ngrok http 3000
```

ngrok will display a forwarding URL like `https://abc123.ngrok-free.app`.

### 4. Configure QStash callback URL

When publishing messages to QStash during local development, set `NEXT_PUBLIC_APP_URL` in `.env.local` to your ngrok URL:

```
NEXT_PUBLIC_APP_URL=https://abc123.ngrok-free.app
```

This ensures the enqueue endpoint publishes messages targeting your local machine via the ngrok tunnel.

### 5. Test end-to-end

```bash
# Enqueue a test task (requires authenticated session + CSRF token)
# Easiest: use the app UI or call from browser console while logged in

# Or test worker directly via QStash dashboard:
# 1. Go to https://console.upstash.com/qstash
# 2. Publish a message to https://abc123.ngrok-free.app/api/workers/fast
# 3. Check your terminal for "[worker:fast] Received task" log
```

## Notes

- ngrok URLs change each time you restart (unless you have a paid plan with reserved domains)
- Remember to reset `NEXT_PUBLIC_APP_URL` back to `http://localhost:3000` after testing
- On Windows, ensure ngrok is in your PATH or use the full path to the executable
