from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200


def test_features_endpoint():
    response = client.get("/features")
    assert response.status_code == 200
    assert isinstance(response.json(), (dict, list))


def test_model_info_endpoint():
    response = client.get("/model-info")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)


def test_valid_prediction():
    response = client.post(
        "/predict",
        json={
            "RIDAGEYR": 55,
            "SMQ020": 1,
            "MCQ010": 2,
            "BMXBMI": 27.5,
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert 0 <= result["probability"] <= 1
    assert 0 <= result["percent"] <= 100
    assert isinstance(result["prediction_set"], list)
    assert isinstance(result["disclaimer"], str)


def test_invalid_age_is_rejected():
    response = client.post(
        "/predict",
        json={
            "RIDAGEYR": 19,
            "SMQ020": 1,
            "MCQ010": 2,
            "BMXBMI": 27.5,
        },
    )
    assert response.status_code == 422
