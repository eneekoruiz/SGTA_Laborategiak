"""Eszenatokien kudeaketa bideak."""
import json
import os
from fastapi import APIRouter
from typing import List, Dict, Any
from pydantic import BaseModel

router = APIRouter()


class ScenarioSummary(BaseModel):
    """Escenario resumen para la respuesta."""
    id: str
    name: str
    description: str
    difficulty_options: List[str]
    map_size: Dict[str, int]


class ScenariosResponse(BaseModel):
    """Respuesta con lista de escenarios."""
    scenarios: List[ScenarioSummary]


# Cargar escenarios desde scenarios.json
def load_scenarios() -> List[Dict[str, Any]]:
    """Cargar los escenarios desde el archivo JSON."""
    scenarios_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "data",
        "scenarios.json"
    )
    try:
        with open(scenarios_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get("scenarios", [])
    except (FileNotFoundError, json.JSONDecodeError):
        # Si no se puede cargar el archivo, devolver escenarios por defecto
        return [
            {
                "id": "green_valley",
                "name": "Iaran Berdea",
                "description": "Hiri jasangarria eraikitzeko aproposa",
                "difficulty_options": ["easy", "medium", "hard"],
                "map_size": {"width": 100, "height": 100}
            },
            {
                "id": "industrial_zone",
                "name": "Industria Gunea",
                "description": "Baliabide asko baina kutsadura handia",
                "difficulty_options": ["easy", "medium", "hard"],
                "map_size": {"width": 100, "height": 100}
            },
            {
                "id": "coastal_city",
                "name": "Kostaldeko Hiria",
                "description": "Turismoari begira dagoen hiria",
                "difficulty_options": ["easy", "medium", "hard"],
                "map_size": {"width": 100, "height": 100}
            }
        ]


def format_scenario_response(scenario: Dict[str, Any]) -> ScenarioSummary:
    """Formatear escenario para la respuesta."""
    return ScenarioSummary(
        id=scenario.get("id"),
        name=scenario.get("name"),
        description=scenario.get("description"),
        difficulty_options=scenario.get("difficulty_options", ["easy", "medium", "hard"]),
        map_size=scenario.get("map_size", {"width": 100, "height": 100})
    )


@router.get("", response_model=ScenariosResponse, tags=["Scenarios"])
async def get_scenarios():
    """Eskura dauden eszenatokiak lortu joko berri bat sortzeko."""
    scenarios = load_scenarios()
    formatted_scenarios = [format_scenario_response(s) for s in scenarios]
    return ScenariosResponse(scenarios=formatted_scenarios)
