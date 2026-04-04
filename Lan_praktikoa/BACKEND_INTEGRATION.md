# Backend Integration Guide

**Status**: ✅ Frontend is BACKEND-READY

The frontend is now hardened and configured for seamless backend integration. This document guides you through connecting the FastAPI/Flask backend.

---

## Quick Start (5 minutes)

### 1. Set Environment Variables

**Development (with mock fallback):**
```bash
# .env.local
VITE_LIVE_MODE=true
VITE_API_URL=http://localhost:8000
```

**Production:**
```bash
# .env.production
VITE_LIVE_MODE=true
VITE_API_URL=https://api.simhiri.example.com
```

### 2. Enable Error Notifications (Optional)

In `frontend/src/App.svelte`, add the error notification component:

```svelte
<script>
  import ApiErrorNotifications from './components/ApiErrorNotifications.svelte';
</script>

<ApiErrorNotifications />

<!-- Rest of your app -->
```

### 3. Start Backend

```bash
cd backend
python -m uvicorn app.main:app --reload
```

### 4. Test Connection

```bash
cd frontend
npm run dev
# Open browser console: [API Config] should show LIVE_MODE: true, API_BASE: http://localhost:8000
```

---

## API Contracts

All request/response types are documented in:

```
frontend/src/types/api.d.ts
```

### Key Namespaces:

- `Auth` — Register, Login, Profile
- `Games` — Create, List, Load, Save
- `CityActions` — Zone, Infrastructure, Build, Demolish
- `Budget` — Tax, Ordinance, Bond
- `Turn` — EndMonth, Attack
- `Queries` — Overlay, Stats, Health, Education
- `Errors` — Error response structures

**If backend response doesn't match types, frontend will fail to parse and show error.*

---

## Backend Configuration

### CORS Setup (Required)

**FastAPI:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Flask:**
```python
from flask_cors import CORS

CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})
```

### Health Check Endpoint (Optional but Recommended)

Implement this to help frontend detect if backend is alive:

```python
# GET /api/health
@app.get("/api/health")
async def health():
    return {"status": "healthy"}
```

Frontend polls this endpoint with 2-second timeout to trigger "Server Offline" notification.

---

## Error Handling Flow

```
API Call (FetchOptions)
  ↓
Try Real Backend (if LIVE_MODE=true)
  ├─ Success → onApiSuccess() [reset failure counter]
  ├─ Network Error → handleApiError() → Notification + Fall back to Mock
  ├─ HTTP Error → handleApiError() → Notification + Fall back to Mock
  └─ Timeout → handleApiError() → Notification + Fall back to Mock
  ↓
Return Result (real or mock)
```

### What Frontend Does on API Failure:

1. ✅ **Catches error** — Doesn't crash app
2. ✅ **Logs endpoint** — Console shows which endpoint failed
3. ✅ **Shows notification** — Toast appears in top-right
4. ✅ **Falls back to mock** — User can continue playing
5. ✅ **Tracks health** — After 2 failures, shows "Server Offline" banner

---

## Debugging

### Check Configuration

Open browser console and look for:
```
[API Config] {
  LIVE_MODE: true,
  API_BASE: "http://localhost:8000",
  Backend: "REAL (FastAPI/Flask)",
  Timeout: "10000ms"
}
```

### View API Calls

Enable debug logging in `.env.local`:
```
VITE_DEBUG=true
```

Console will show:
```
[API Config] {...}
[API] Real API failed for /api/games/123, falling back to mock: Error message
[API Error] /api/games/123: error details
```

### Test Endpoints

Use curl or Postman to test backend directly:

```bash
# Should return 200 OK
curl -X GET http://localhost:8000/api/health

# Should return game state
curl -X GET http://localhost:8000/api/games/game-001 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Deployment Checklist

- [ ] Backend endpoints return correct JSON matching `api.d.ts` contracts
- [ ] CORS headers configured for frontend domain
- [ ] `/api/health` endpoint returns `{"status": "healthy"}`
- [ ] All required endpoints implemented (see SPECS.md § 2)
- [ ] Error responses follow `Errors` namespace structure
- [ ] JWT token validation works
- [ ] Database connection tested
- [ ] Rate limiting configured (optional)
- [ ] API versioning strategy decided (v1, v2, etc.)
- [ ] Logging configured for debugging
- [ ] Set `VITE_LIVE_MODE=true` in production `.env`
- [ ] Set `VITE_API_URL` to production backend URL
- [ ] Test with real network conditions
- [ ] Load testing completed

---

## Rollback to Mocks

If backend goes down in production:

```bash
# .env.local / .env.production
VITE_LIVE_MODE=false
```

Frontend automatically uses mocks. Restart frontend, app continues working.

---

## Performance Notes

- **Request Timeout**: 10 seconds (hardcoded in `apiService.ts`)
  - Edit `const API_TIMEOUT = 10000` to change
- **Health Check**: 2 second timeout (in `isBackendHealthy()`)
- **Failure Threshold**: 2 consecutive failures before marking offline
- **Error Notification**: Auto-dismiss after 5 seconds
- **No Caching**: Each request goes to backend (intentional for live state)

---

## Support

For issues or questions about backend integration:

1. Check [api.d.ts](./src/types/api.d.ts) for request/response formats
2. Check [apiService.ts](./src/services/apiService.ts) for endpoint patterns
3. Check [errorHandler.ts](./src/services/errorHandler.ts) for error flow
4. Check browser console for `[API]` logs
5. Verify CORS headers in response

---

**Frontend is ready. Backend team can now safely implement the API.** ✨

No frontend changes needed when backend is deployed. Just set env vars and go live.
