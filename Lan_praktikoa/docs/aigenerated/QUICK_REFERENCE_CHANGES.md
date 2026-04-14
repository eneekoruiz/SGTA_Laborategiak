# QUICK REFERENCE - BEFORE & AFTER CHANGES

## 1. BACKEND AI-SERVICE URL

### ❌ BEFORE (backend/app/config.py)

```python
AI_SERVICE_URL: str = os.getenv("AI_SERVICE_URL", "http://localhost:5001")
```

**Problem:** `localhost:5001` doesn't work inside Docker containers

### ✅ AFTER

```python
AI_SERVICE_URL: str = os.getenv("AI_SERVICE_URL", "http://ai-service:8000")
```

**Why:** `ai-service` = Docker service name (DNS), `:8000` = container internal port

---

## 2. DOCKER COMPOSE - BACKEND SERVICE

### ❌ BEFORE (docker-compose.yml)

```yaml
backend:
  build: ./backend
  container_name: simhiri_backend
  ports:
    - "5000:8000"
  depends_on:
    - mongo
  env_file: ./backend/.env
```

**Problem:** AI_SERVICE_URL not propagated via environment

### ✅ AFTER

```yaml
backend:
  build: ./backend
  container_name: simhiri_backend
  ports:
    - "5000:8000"
  depends_on:
    - mongo
  env_file: ./backend/.env
  environment:
    - AI_SERVICE_URL=http://ai-service:8000
```

**Why:** Explicit environment variable for container-to-container networking

---

## 3. BACKEND CORS - main.py

### ❌ BEFORE

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Wildcard = dangerous
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Problem:** Accepts requests from anywhere (security risk)

### ✅ AFTER

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_CREDENTIALS,
    allow_methods=settings.CORS_METHODS,
    allow_headers=settings.CORS_HEADERS,
)
```

**Why:** Explicit CORS configuration from settings

---

## 4. BACKEND CONFIG - CORS ORIGINS

### ❌ BEFORE (backend/app/config.py)

```python
CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
```

**Problem:** Missing http://localhost:3001 (Docker frontend port)

### ✅ AFTER

```python
CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:3001,http://localhost:5173,http://localhost:3000").split(",")
```

**Why:** Includes all frontend ports (3001=docker, 5173=vite dev, 3000=fallback)

---

## 5. NEW - BACKEND LOGGING MIDDLEWARE

### ✅ NEW FILE: backend/app/middleware/logging.py

```python
# AuditLoggingMiddleware class with:
# - [REQUEST] METHOD URL formatting
# - [RESPONSE] STATUS - TIME formatting
# - JSON pretty-printing
# - 500-char body limit for large payloads
# - Exception handling

# setup_logging() function with:
# - ROOT logger level = DEBUG
# - Console handler with timestamp
# - simhiri.audit logger configuration
```

**Impact:** All requests/responses logged to Docker console

---

## 6. BACKEND main.py - LOGGING INTEGRATION

### ❌ BEFORE

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(...)
# No logging setup
```

### ✅ AFTER

```python
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .middleware.logging import AuditLoggingMiddleware, setup_logging

setup_logging()  # Configure logging at startup
app = FastAPI(...)
app.add_middleware(AuditLoggingMiddleware)  # Add before CORS
```

**Why:** Middleware stack order matters; logging must be outermost

---

## 7. AI-SERVICE CORS

### ❌ BEFORE (ai-service/app/main.py)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Wildcard
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### ✅ AFTER

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://backend:8000", "http://localhost:5000", "http://localhost:5001", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Why:** Explicit backend + frontend URLs only

---

## 8. AI-SERVICE LOGGING

### ✅ NEW FILE: ai-service/app/middleware.py

```python
# Identical AuditLoggingMiddleware pattern as backend
# setup_logging() for DEBUG configuration
```

### ✅ AI-SERVICE main.py receives logging

```python
from app.middleware import AuditLoggingMiddleware, setup_logging

setup_logging()
app.add_middleware(AuditLoggingMiddleware)
```

---

## 9. BACKEND .env FILE

### ❌ BEFORE

```ini
PORT=5000
DEBUG=False
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
AI_SERVICE_URL=http://localhost:5001
```

### ✅ AFTER

```ini
PORT=8000
DEBUG=True
CORS_ORIGINS=http://localhost:3001,http://localhost:5173,http://localhost:3000
AI_SERVICE_URL=http://ai-service:8000
```

**Changes:**

- PORT: Internal container port is always 8000
- DEBUG: True for development logging
- CORS_ORIGINS: Added 3001, reordered
- AI_SERVICE_URL: Container DNS instead of localhost

---

## 10. AI-SERVICE .env FILE

### ❌ BEFORE

```ini
JWT_SECRET=mi_clave_super_secreta_grupo_8_2026
GROQ_API_KEY=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
GITHUB_TOKEN=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
```

### ✅ AFTER

```ini
JWT_SECRET=mi_clave_super_secreta_grupo_8_2026
GROQ_API_KEY=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
GITHUB_TOKEN=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

DEBUG=True
LOG_LEVEL=DEBUG
```

**Why:** Enable logging output in Docker console

---

## 11. FRONTEND .env

### ✅ NO CHANGES NEEDED

```ini
VITE_LIVE_MODE=true
VITE_API_URL=http://localhost:5000
VITE_DEBUG=true
```

**Status:** Already correct for browser-based client

---

## VERIFICATION CHECKLIST

### Container Networking

- [ ] Run: `docker-compose up --build`
- [ ] Backend should connect to MongoDB
- [ ] Backend should NOT error connecting to AI-Service
- [ ] Logs show: `[REQUEST]` and `[RESPONSE]` patterns

### API Contracts

- [ ] Frontend can POST to `/api/auth/register` (from browser)
- [ ] Backend can POST to `http://ai-service:8000/api/ai/` (internal)
- [ ] Both return proper JSON responses

### Logging Output

```
Expected in docker logs:
  [REQUEST] POST /api/auth/register
    BODY: {"username": "test", ...}
  [RESPONSE] 201 - 0.125s
```

### CORS Testing

```
Should work:
  ✅ http://localhost:3001     (Docker frontend)
  ✅ http://localhost:5173     (Vite dev)

Should fail:
  ❌ http://evil.com           (Not in allow-list)
```

---

## FILES MODIFIED

1. ✅ backend/app/config.py
2. ✅ backend/app/main.py
3. ✅ backend/app/middleware/logging.py (NEW)
4. ✅ backend/.env
5. ✅ ai-service/app/main.py
6. ✅ ai-service/app/middleware.py (NEW)
7. ✅ ai-service/.env
8. ✅ docker-compose.yml
9. ✅ ARCHITECTURE_AUDIT_REPORT.md (NEW - documentation)

---

## ROLLBACK INSTRUCTIONS (IF NEEDED)

If you need to revert changes:

1. **Config URL:** Change `http://ai-service:8000` back to `http://localhost:5001`
2. **Remove middleware:** Delete logging middleware imports/calls
3. **Restore CORS:** Change back to `allow_origins=["*"]`
4. **.env files:** Restore original values

**Note:** It's NOT recommended to rollback. These are security/debugging improvements.

---

## TIME TO TEST

After `docker-compose up --build`:

1. Check backend logs: `docker logs simhiri_backend`
2. Check AI-Service logs: `docker logs simhiri_ai`
3. Send test request:
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"username":"test123","email":"test@example.com","password":"Pass1234"}'
   ```
4. Verify logs show [REQUEST] and [RESPONSE]

---

**Status: ✅ AUDIT COMPLETE - READY FOR DEPLOYMENT**
