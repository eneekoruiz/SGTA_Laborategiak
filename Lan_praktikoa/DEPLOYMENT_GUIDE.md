# SimHiri - Despliegue Gida (Team 8)

Gida honek azaltzen du nola konfiguratu eta exekutatu SimHiri aplikazioa Docker erabiliz.

## 1. Aurrebaldintzak

- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Git** biltegi klonatua

## 2. Konfigurazioa

### 2.1. Backend Konfigurazioa

Sortu `backend/.env` fitxategia:

```env
# MongoDB Konfigurazioa
MONGO_URL=mongodb://mongo:27017
MONGO_DB_NAME=simhiri

# JWT Konfigurazioa
JWT_SECRET=zure_jwt_secret_aurreratu_aldatu_produkzioan
JWT_EXPIRATION_HOURS=24

# CORS Konfigurazioa
CORS_ORIGINS=http://localhost:3001,http://localhost:3000
CORS_CREDENTIALS=true
CORS_METHODS=*
CORS_HEADERS=*

# Debug Modea
DEBUG=false

# AI Zerbitzua URL
AI_SERVICE_URL=http://ai-service:8000

# API Informazioa
API_TITLE=SimHiri Backend API
API_DESCRIPTION=SimHiri jokoaren backend APIa
API_VERSION=1.0.0

# Zerbitzari Konfigurazioa
HOST=0.0.0.0
PORT=8000
```

### 2.2. AI Service Konfigurazioa

Sortu `ai-service/.env` fitxategia:

```env
# GroQ API Konfigurazioa
GROQ_API_KEY=gsk_zure_groq_api_key_hemen
GROQ_MODEL_PRIMARY=llama3-70b-8192
GROQ_MODEL_FALLBACK=llama3-8b-8192
GROQ_MAX_TOKENS=4096
GROQ_TEMPERATURE=0.7

# GitHub Models Konfigurazioa
GITHUB_TOKEN=ghp_zure_github_token_hemen
GITHUB_MODEL_PRIMARY=gpt-4o
GITHUB_MODEL_FALLBACK=llama-3.1-8b-instruct

# AI Zerbitzua Konfigurazioa
AI_SERVICE_PORT=8000
AI_REQUEST_TIMEOUT=30
AI_MAX_RETRIES=3
AI_CONTEXT_MAX_TOKENS=2000
```

**OHARRA**: LLM gakoak lortzeko:
- GroQ: https://console.groq.com/
- GitHub Models: https://github.com/marketplace/models

### 2.3. Frontend Konfigurazioa

Sortu `frontend/.env` fitxategia:

```env
# Backend API URL
VITE_API_URL=http://localhost:5000

# Live mode (true = backend erreala, false = mock)
VITE_LIVE_MODE=true
```

## 3. Docker bidez Exekutatu

### 3.1. Eraiki eta Abiarazi

```bash
# Proiektuaren errootean
docker compose up --build
```

Komando honek:
1. Irudi guztiak eraikiko ditu
2. 4 edukiontzi abiaraziko ditu:
   - `simhiri_db` (MongoDB)
   - `simhiri_ai` (AI Service)
   - `simhiri_backend` (Backend)
   - `simhiri_frontend` (Frontend)

### 3.2. Atzeko Planan Exekutatu

```bash
docker compose up -d --build
```

### 3.3. Logak Ikusi

```bash
# Zerbitzu guztien logak
docker compose logs -f

# Zerbitzu jakin baten logak
docker compose logs -f backend
docker compose logs -f ai-service
docker compose logs -f frontend
```

### 3.4. Gelditu

```bash
docker compose down
```

### 3.5. Garbitu (Bolumenak Ezabatu)

```bash
docker compose down -v
```

## 4. Ataka Mapa

| Zerbitzua | Kanpo Ataka | Barne Ataka | URL |
|-----------|-------------|-------------|-----|
| MongoDB | 27017 | 27017 | mongodb://localhost:27017 |
| Backend | 5000 | 8000 | http://localhost:5000 |
| AI Service | 5001 | 8000 | http://localhost:5001 |
| Frontend | 3001 | 3000 | http://localhost:3001 |

## 5. API Dokumentazioa

Backend abiarazi ondoren, API dokumentazioa eskuragarri dago:

- **Swagger UI**: http://localhost:5000/docs
- **ReDoc**: http://localhost:5000/redoc

## 6. Proba Fluxua

### 6.1. Erabiltzailea Erregistratu

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "password": "Test1234!"
  }'
```

### 6.2. Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "password": "Test1234!"
  }'
```

Erantzunean JWT tokena jasoko duzu. Gorde aldagai batean:

```bash
TOKEN="zuer_jwt_token_hemen"
```

### 6.3. Partida Berria Sortu

```bash
curl -X POST http://localhost:5000/api/games \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Nire Proba Partida",
    "scenario_id": "hiriberria_1",
    "difficulty": "medium",
    "player_city_name": "Bilbo",
    "ai_personality": "balanced",
    "disasters_enabled": true
  }'
```

Erantzunean `game_id` jasoko duzu.

### 6.4. Zona Jarri

```bash
GAME_ID="zuer_game_id_hemen"

curl -X POST http://localhost:5000/api/games/$GAME_ID/zone \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "zone_type": "residential_light",
    "position": {"x": 10, "y": 10},
    "size": {"w": 3, "h": 3}
  }'
```

### 6.5. Hilabetea Amaitu

```bash
curl -X POST http://localhost:5000/api/games/$GAME_ID/endMonth \
  -H "Authorization: Bearer $TOKEN"
```

Honek:
1. Jokalariaren hiriaren simulazioa exekutatuko du
2. AI zerbitzura deia egingo du
3. AI ekintzak AI hiriari aplikatuko dizkio
4. AI hiriaren simulazioa exekutatuko du
5. Egoera eguneratua itzuliko du

### 6.6. Estatistikak Kontsultatu

```bash
curl http://localhost:5000/api/games/$GAME_ID/stats \
  -H "Authorization: Bearer $TOKEN"
```

## 7. Garapen Lokalean

Docker erabili beharrean, garapen lokalean exekutatu nahi baduzu:

### 7.1. MongoDB

```bash
docker run -d -p 27017:27017 --name simhiri_db mongo:latest
```

### 7.2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Editatu backend/.env eta aldatu MONGO_URL
# MONGO_URL=mongodb://localhost:27017

uvicorn app.main:app --reload --port 8000
```

### 7.3. AI Service

```bash
cd ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

uvicorn app.main:app --reload --port 8000
```

### 7.4. Frontend

```bash
cd frontend
npm install
npm run dev
```

## 8. Arazo Konponketa

### 8.1. MongoDB Konexio Errorea

```
pymongo.errors.ServerSelectionTimeoutError
```

**Konponbidea**:
- Ziurtatu MongoDB martxan dagoela
- Egiaztatu `MONGO_URL` zuzena dela
- Docker bidez: `MONGO_URL=mongodb://mongo:27017`
- Lokalera: `MONGO_URL=mongodb://localhost:27017`

### 8.2. AI Zerbitzua Ez Dago Eskuragarri

```
AI zerbitzua errorea: Connection refused
```

**Konponbidea**:
- Ziurtatu AI service martxan dagoela
- Egiaztatu `AI_SERVICE_URL` zuzena dela
- Docker bidez: `AI_SERVICE_URL=http://ai-service:8000`
- Lokalera: `AI_SERVICE_URL=http://localhost:8000` (AI service ataka desberdina badu)

### 8.3. Frontend Mock Moduan Dabil

```
VITE_LIVE_MODE=false dela egiaztatu
```

**Konponbidea**:
- Ezarri `frontend/.env` fitxategian: `VITE_LIVE_MODE=true`
- Berrabiarazi frontend edukiontzia: `docker compose restart frontend`

### 8.4. JWT Token Errors

```
401 Unauthorized
```

**Konponbidea**:
- Ziurtatu tokena ongi gordeta dagoela
- Egiaztatu `JWT_SECRET` berdina dela backend-ean
- Tokena iraungi daiteke (24h defektuz)

### 8.5. CORS Erroreak

```
Access-Control-Allow-Origin
```

**Konponbidea**:
- Egiaztatu `CORS_ORIGINS` zuzena dela backend `.env`-n
- Frontend URLa sartu behar da: `http://localhost:3001`

## 9. Docker Irudiak Berreraiki

Zerbait aldatu bada eta berreraiki behar baduzu:

```bash
# Cache gabe berreraiki
docker compose build --no-cache

# Zerbitzu jakin bat berreraiki
docker compose build backend
docker compose build ai-service
docker compose build frontend
```

## 10. Bolumenak eta Datuak

Datuak MongoDB bolumenean gordetzen dira:

```bash
# Bolumenak ikusi
docker volume ls | grep mongo

# Bolumenaren edukia ikusi
docker run --rm -v simhiri_mongo_data:/data alpine ls -la /data
```

Datuak garbitzeko (partida guztiak ezabatu):

```bash
docker compose down -v
docker compose up -d
```

## 11. Produkzio Despliegua

Produkzioan, kontuan hartu:

1. **SSL/TLS**: HTTPS erabili
2. **Gako Seguruak**: `JWT_SECRET` ausazko gako luzea erabili
3. **LLM Gakoak**: Ez gorde kode errepositorioan
4. **MongoDB**: Autentikazioa aktibatu
5. **Docker**: `--restart unless-stopped` erabili
6. **Logak**: Log rotation aktibatu

Adibidez:

```bash
docker compose up -d --build
docker update --restart unless-stopped simhiri_db simhiri_ai simhiri_backend simhiri_frontend
```

## 12. Monitorizazioa

```bash
# Edukiontzien egoera ikusi
docker compose ps

# Erabilera ikusi (CPU, Memoria)
docker stats

# Logak jarraitu
docker compose logs -f backend
```

## 13. Oharrak

- **Lehen abiaraztean** MongoDB indexak sortzen dira
- **AI zerbitzua** lehen deian motelagoa izan daiteke (hot start)
- **Frontend** Vite bidez zerbitzatzen da garapenean
- **Backend** Uvicorn ASGI zerbitzaria erabiltzen du

---

**Laguntza gehiagorako**, ikusi:
- [README.md](README.md)
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- [docs/SPECS.md](docs/SPECS.md)
