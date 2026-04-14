# SimHiri - Team 8 (Hezkuntza & Osasuna)

SimCity 2000 joko klasikoan inspiratutako hiri-eraikuntza simulazio joko web aplikazioa. Talde 8k garatua, **Hezkuntza (EQ)** eta **Osasuna (HQ)** moduluan espezializatua.

## 🚀 Azkar Hasi

### Aurrebaldintzak

- Docker eta Docker Compose
- Node.js 18+ (garapen lokalean soilik)
- Python 3.10+ (garapen lokalean soilik)

### Docker bidez Exekutatu (Gomendatua)

1. **Klonatu biltegia:**
   ```bash
   git clone <repository-url>
   cd Lan_praktikoa
   ```

2. **Sortu `.env` fitxategiak:**

   **Backend** (`backend/.env`):
   ```env
   MONGO_URL=mongodb://mongo:27017
   MONGO_DB_NAME=simhiri
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   JWT_EXPIRATION_HOURS=24
   CORS_ORIGINS=http://localhost:3001,http://localhost:3000
   DEBUG=false
   AI_SERVICE_URL=http://ai-service:8000
   ```

   **AI Service** (`ai-service/.env`):
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL_PRIMARY=llama3-70b-8192
   GROQ_MODEL_FALLBACK=llama3-8b-8192
   GITHUB_TOKEN=your_github_token_here
   GITHUB_MODEL_PRIMARY=gpt-4o
   AI_SERVICE_PORT=8000
   AI_REQUEST_TIMEOUT=30
   ```

   **Frontend** (`frontend/.env`):
   ```env
   VITE_API_URL=http://localhost:5000
   VITE_LIVE_MODE=true
   ```

3. **Exekutatu Docker Compose:**
   ```bash
   docker compose up --build
   ```

4. **Sartu nabigatzailean:**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:5000
   - API Docs: http://localhost:5000/docs
   - AI Service: http://localhost:5001

### Garapen Lokalean Exekutatu

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

#### AI Service

```bash
cd ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### MongoDB

```bash
docker run -d -p 27017:27017 --name simhiri_db mongo:latest
```

## 📋 Ezaugarriak

### Jokoaren Ezaugarriak

- ✅ **Erabiltzaile sistema**: Erregistroa, autentikazioa (JWT), profilak
- ✅ **Partida kudeaketa**: Sortu, gorde, kargatu, ezabatu
- ✅ **Hileko tick sistema**: Jokalariaren txanda → Simulazioa → AI txanda → Simulazioa
- ✅ **Zonifikazioa**: 6 zona mota (Erresidentzial/Komertzial/Industrial × Arin/Trinkoa)
- ✅ **Azpiegiturak**: Errepideak, energia lineak, ur-hodiak, trenbideak
- ✅ **Eraikinak**: Zentral elektrikoak, zerbitzuak, hezkuntza & osasuna
- ✅ **Aurrekontu sistema**: Zergak (R/C/I), sailkako finantzaketa, bonuak
- ✅ **Ordenantzak**: 12 ordenantza aktibatu/desaktibatzeko
- ✅ **Simulazio motorra**: RCI eskaria, biztanle hazkundea, ekonomia, metrikak
- ✅ **Hezkuntza (EQ) & Osasuna (HQ)**: Talde 8 modulua osoa
- ✅ **AI aurkaria**: GroQ/GitHub Models LLM bultzatutako hiri kudeatzailea
- ✅ **Hondamendiak**: Ausazko eta erasoko hondamendiak
- ✅ **Garaipena baldintzak**: Populazioa, puntuazioa, bankarrota
- ✅ **Trikimailu sistema**: Ctrl+Tab kontsola

### Frontend (Svelte 5)

- ✅ Mapa isometriko osoa (Canvas 2D renderer)
- ✅ Zoom (0.45x - 2.6x) eta pan kamera
- ✅ 6 zona mota, 27+ eraikin, azpiegitura guztiak
- ✅ 11 datu gainjarri mota
- ✅ Aurrekontu panela, ordenantza panela
- ✅ EQ/HQ panela (Taldea 8)
- ✅ AI txandaren bistaratzea (pantaila osoa edo zatitua)
- ✅ RCI eskari barra
- ✅ Trikimailu kontsola

### Backend (FastAPI)

- ✅ REST API osoa
- ✅ MongoDB integrazioa (Motor async)
- ✅ Autentikazioa JWT-rekin
- ✅ Simulazio motor konplexua
- ✅ AI zerbitzu integrazioa
- ✅ Errore kudeaketa egituratua

### AI Zerbitzua

- ✅ GroQ eta GitHub Models hornitzaileak
- ✅ Failover automatikoa
- ✅ 5 alkate nortasun
- ✅ Ekintzen balidazioa

## 🎮 Jokoaren Arauak

### Hileko Tick Sekuentzia

1. **Energia sarea** eguneratu (BFS zentral elektrikoetatik)
2. **Ur sarea** eguneratu (BFS ur-ponpetatik)
3. **Errepide sarbidea** eguneratu
4. **Zona garapena** egiaztatu (mailak 0→1→2→3)
5. **Zona abandonatzea** egiaztatu
6. **RCI eskaria** kalkulatu
7. **Biztanle hazkundea** kalkulatu
8. **Diru-sarrerak/gastuak** kalkulatu
9. **Altxorra** eguneratu
10. **Metrikak** eguneratu (EQ, HQ, krimena, kutsadura, lur-balioa)
11. **Ausazko hondamendiak** (aktibatuta badaude)
12. **AI txanda** exekutatu
13. **Garaipena baldintzak** egiaztatu
14. **Auto-gordetzea**

### Hezkuntza (EQ) Kalkulua

```
target_eq = 50 + (eskola×5 + unibertsitatea×10 + liburutegia×3 + museoa×4) × finantzaketa%
eq_change = (target_eq - current_eq) × 0.01  # Belaunaldi artekoa (%1/hil)
```

**Efektuak:**
- High-tech industria %: EQ / 200
- Krimen murrizketa: EQ × 0.1
- Lur balio bonusa: EQ × 0.5

### Osasun (HQ) Kalkulua

```
target_hq = 50 + (ospitale×50 × finantzaketa%) - (kutsadura_aire + kutsadura_ur) × 0.3
hq_change = (target_hq - current_hq) × 0.02  # EQ baino azkarragoa (%2/hil)
```

**Efektuak:**
- Bizi itxaropena: 50 + (HQ × 0.2) urte
- Heriotza tasa: 10 - (HQ × 0.05) per 1000

### Garaipena Baldintzak

| Garaipena | Baldintza |
|-----------|-----------|
| Populazioa | Lehenengo hiria 100,000 biztanlera iristen dena |
| Puntuazioa | 100 urte ondoren (1200 hilabete), puntuazio altuena |
| Bankarrota | Aurkariaren altxorra < -§100,000 12 hilabete jarraian |
| Porrota | Zure altxorra < -§100,000 12 hilabete jarraian |

## 🧪 Trikimailu Kodeak

Aktibatu **Ctrl+Tab** mapa bistan:

| Kodea | Efektua |
|-------|---------|
| `diru_asko` | Altxorra §1,000,000-ra |
| `energia_mugagabea` | Energia estaldura %100 |
| `populazio_maximoa` | Populazioa +10,000 |
| `zerga_zero` | Zergak %0 |

## 📁 Proiektu Egitura

```
.
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── routes/         # API endpoint-ak
│   │   ├── services/       # Negozio logika
│   │   ├── models/         # Pydantic ereduak
│   │   ├── auth/           # Autentikazioa
│   │   ├── db/             # MongoDB
│   │   └── data/           # Datu estatikoak
│   ├── requirements.txt
│   └── Dockerfile
├── ai-service/             # AI zerbitzua
│   ├── app/
│   │   ├── routes/
│   │   ├── providers/      # LLM hornitzaileak
│   │   └── services/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # Svelte 5 frontend
│   ├── src/
│   │   ├── components/     # Joko osagaiak
│   │   ├── views/          # Bistak
│   │   ├── services/       # API geruza
│   │   ├── store/          # Egoera kudeaketa
│   │   └── types/          # TypeScript definizioak
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── docs/                   # Dokumentazioa
    ├── SimHiri_praktika.md
    ├── SPECS.md
    └── AGENT-*.md
```

## 🔧 API Endpoint-ak

### Autentikazioa

- `POST /api/auth/register` - Erabiltzailea erregistratu
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Profila lortu

### Partidak

- `GET /api/games` - Partidak zerrendatu
- `POST /api/games` - Partida berria
- `GET /api/games/{id}` - Partida kargatu
- `POST /api/games/{id}/save` - Partida gorde
- `DELETE /api/games/{id}` - Partida ezabatu

### Hiri Ekintzak

- `POST /api/games/{id}/zone` - Zona jarri
- `POST /api/games/{id}/infrastructure` - Azpiegitura
- `POST /api/games/{id}/build` - Eraikina
- `POST /api/games/{id}/demolish` - Bota
- `PUT /api/games/{id}/budget` - Aurrekontua
- `POST /api/games/{id}/ordinance` - Ordenantza
- `POST /api/games/{id}/bond` - Bonua
- `POST /api/games/{id}/endMonth` - Hilabetea amaitu
- `POST /api/games/{id}/cheat` - Trikimailua

### Kontsultak

- `GET /api/games/{id}/overlay/{type}` - Datu gainjarria
- `GET /api/games/{id}/stats` - Estatistikak

## 📊 Teknologia Pilak

| Geruza | Teknologia |
|--------|------------|
| Frontend | Svelte 5, TypeScript 5.5, Vite 5, Canvas 2D |
| Backend | FastAPI 0.104+, Python 3.10, Motor (MongoDB async) |
| AI Service | FastAPI, httpx, GroQ, GitHub Models |
| Datu-basea | MongoDB (Motor async driver) |
| Desplieguea | Docker, Docker Compose |

## 📝 Dokumentazioa

- **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** - Egoera txosten osoa
- **[docs/SimHiri_praktika.md](docs/SimHiri_praktika.md)** - Praktika enuntziatua
- **[docs/SPECS.md](docs/SPECS.md)** - Zehaztapen tekniko osoa
- **[docs/AGENT-*.md](docs/)** - Agent argibideak

## 👥 Taldea 8

- **Frontend**: Svelte
- **Backend**: FastAPI
- **Modulua**: Hezkuntza & Osasuna (EQ/HQ)

## 📄 Lizentzia

Proiektu hau hezkuntzarako soilik da. Ez du merkataritza helbururik.

AA bidez sortutako baliabide guztiak argi etiketatuta daude "AA bidez sortua SimHiri hezkuntza proiekturako" adierazpenarekin.

## 🐛 Ezaguneko Arazoak

1. **Hondamendi sistema**: `_apply_disaster_damage()` funtzioak ausazko entitate bat kentzen du soilik. Posizio kontzientzia eta hedapena falta dira.

2. **Eraikin zahartzea**: Zentral elektrikoak ez dira automatikoki lehertzen 50 urte ondoren.

3. **Gainjarri kalkuluak**: `GET /api/games/{id}/overlay/{type}` endpoint-ak egitura hutsa itzultzen du. Kalkulu errealak inplementatu behar dira.

## 🤝 Laguntza

Arazoak badituzu:

1. Ziurtatu `.env` fitxategiak ongi konfiguratuta daudela
2. Ikusi Docker logak: `docker compose logs -f`
3. Ikusi backend logak: Erroreak `AuditLoggingMiddleware` bidez erregistratzen dira
4. Probatu API dokumentazioa: http://localhost:5000/docs

## 📚 Erreferentziak

- [SimCity 2000 Wiki](https://simcity.fandom.com/wiki/SimCity_2000)
- [FastAPI Dokumentazioa](https://fastapi.tiangolo.com/)
- [Svelte Dokumentazioa](https://svelte.dev/docs)
- [MongoDB Dokumentazioa](https://www.mongodb.com/docs/)
