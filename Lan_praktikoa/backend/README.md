# SimHiri Backend - FastAPI (Group 8: Education & Health)

This is the backend API for SimHiri, a city-building strategy game. Group 8 specializes in **Education Quality (EQ)** and **Health Quality (HQ)** metrics and systems.

## Quick Start

### Prerequisites
- Python 3.11+
- MongoDB 7.0+
- pip or conda

### Installation

1. **Create virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your local MongoDB connection
```

4. **Run server:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
```

The API will be available at `http://localhost:5000`

### Docker Setup

```bash
# Start all services (backend + MongoDB)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## API Documentation

Once running, visit:
- **Swagger UI:** http://localhost:5000/docs
- **ReDoc:** http://localhost:5000/redoc

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                      # FastAPI app entry point
│   ├── config.py                    # Configuration management
│   ├── models/                      # Pydantic models
│   │   ├── user.py                 # User models
│   │   ├── game.py                 # Game state models
│   │   ├── city.py                 # City & metrics models (EQ/HQ)
│   │   ├── zone.py                 # Zone models
│   │   ├── building.py             # Building models (schools, hospitals, etc.)
│   │   ├── tile.py                 # Map tile models
│   │   ├── infrastructure.py       # Infrastructure models
│   │   └── budget.py               # Budget models
│   ├── routes/                      # API endpoints
│   │   ├── auth.py                 # /api/auth/* endpoints
│   │   ├── games.py                # /api/games/* endpoints
│   │   └── zone.py                 # Zone/building/infra endpoints
│   ├── services/                    # Business logic
│   │   └── education_health_service.py  # EQ/HQ calculations (Group 8 focus)
│   ├── auth/                        # Authentication utilities
│   ├── db/                          # Database interactions
│   ├── middleware/                  # Custom middleware
│   └── data/                        # Static game data (JSON)
│       ├── buildings.json          # Building definitions
│       ├── ordinances.json         # Ordinance definitions
│       ├── disasters.json          # Disaster configurations
│       └── scenarios.json          # Game scenarios
├── requirements.txt
├── Dockerfile
└── .env
```

## Key Features

### Authentication (`/api/auth/`)
- `POST /register` - Create new user
- `POST /login` - Authenticate and get JWT token
- `GET /profile` - Get authenticated user profile

### Game Management (`/api/games/`)
- `GET /` - List user's games
- `POST /` - Create new game
- `GET /{gameId}` - Load game
- `POST /{gameId}/save` - Save game
- `DELETE /{gameId}` - Delete game
- `GET /scenarios` - Get available scenarios

### City Actions (`/api/games/{gameId}/...`)
- `POST /zone` - Create residential/commercial/industrial zone
- `POST /infrastructure` - Build roads, power lines, etc.
- `POST /build` - Build structures (schools, hospitals, power plants, etc.)
- `POST /demolish` - Demolish structures

## Group 8: Education & Health Systems

### Education Quality (EQ)
Calculated based on:
- Schools (EQ +5 each)
- Colleges (EQ +10 each)
- Libraries (EQ +3 each)
- Museums (EQ +4 each)
- Education funding percentage
- Active ordinances (Pro-Reading Campaign, Junior Sports, etc.)

**Formula:**
```
target_eq = sum(facility_eq_bonus * funding_pct) + ordinance_bonuses
eq_change_per_month = (target_eq - current_eq) * 0.01  # Slow change (generational)
```

**Effects of High EQ:**
- Reduces crime (up to -100)
- Increases land value (up to +100)
- Enables high-tech industry (max 100%)

### Health Quality (HQ)
Calculated based on:
- Hospital coverage (HQ +50 per effective hospital)
- Pollution penalty (air pollution reduces HQ)
- Health funding percentage
- Active ordinances (Free Clinics, CPR Training, Smoking Ban, etc.)

**Formula:**
```
hospital_coverage = population_served / population_total
target_hq = hospital_coverage * 50 - pollution_penalty * 0.3 + ordinance_bonuses
hq_change_per_month = (target_hq - current_hq) * 0.02  # Faster response than EQ
```

**Effects of High HQ:**
- Increases population lifespan (+0.2 years per HQ point)
- Decreases mortality rate (-0.05 deaths per 1000 per HQ point)

### Relevant Ordinances (Group 8)
- **Free Clinics** - Cost §50/year, HQ +5%
- **Pro-Reading Campaign** - Cost §50/year, EQ +5%
- **CPR Training** - Cost §25/year, HQ +2%
- **Smoking Ban** - Free, HQ +3%
- **Junior Sports** - Cost §50/year, Reduces crime 5%, EQ +3%

## Development Notes

### Mock Data
Currently using in-memory mock storage. To integrate MongoDB:
1. Replace `mock_users` and `mock_games` in `routes/` with database calls
2. Use `pymongo` or `motor` (async) for database operations
3. Implement repositories in `db/` package

### Service Calculations
The `EducationHealthService` provides core EQ/HQ calculations:
```python
from app.services import EducationHealthService

# Calculate EQ
eq_value, breakdown = EducationHealthService.calculate_eq(
    city_state=game_state["player_city"],
    active_ordinances=game_state["player_city"]["ordinances"]
)

# Calculate HQ
hq_value, breakdown = EducationHealthService.calculate_hq(
    city_state=game_state["player_city"],
    active_ordinances=game_state["player_city"]["ordinances"],
    pollution_air=game_state["player_city"]["metrics"]["pollution_air"]
)
```

## API Response Examples

### Create Game
```json
{
  "id": "game_1",
  "message": "Game created successfully",
  "game": {
    "id": "game_1",
    "user_id": "user_1",
    "name": "My First City",
    "scenario_id": "city_new",
    "difficulty": "medium",
    ...
  }
}
```

### Create Zone
```json
{
  "success": true,
  "message": "Zone residential_light created at {\"x\": 10, \"y\": 15}",
  "zone": {
    "id": "zone_1234",
    "type": "residential_light",
    "position": {"x": 10, "y": 15},
    "size": {"w": 2, "h": 2},
    "development_level": 0,
    ...
  },
  "cost": 20,
  "game_update": {
    "treasury_change": -20,
    "zones_added": 1
  }
}
```

### Build School
```json
{
  "success": true,
  "message": "Building school built successfully",
  "building": {
    "id": "building_game_1_school",
    "type": "school",
    "position": {"x": 25, "y": 30},
    "cost": 250,
    "funding_pct": 100
  },
  "game_update": {
    "treasury_change": -250,
    "buildings_added": 1,
    "metrics_change": {
      "eq": 5,
      "hq": 0
    }
  }
}
```

## Testing

Run unit tests:
```bash
pytest tests/ -v
```

## License

Part of the SimHiri (Hiri simulazioa) educational project.

## Group 8 Team
Backend: FastAPI + Python
Frontend: Svelte
Focus: Education & Health Systems
