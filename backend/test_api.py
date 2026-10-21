
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["feature_count"] == 5


def test_features_endpoint():
    response = client.get("/features")
    assert response.status_code == 200

    features = response.json()["features"]
    feature_keys = [field["key"] for field in features]

    assert "SMQ040" in feature_keys
    assert len(features) == 5


def test_model_info_endpoint():
    response = client.get("/model-info")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)


def test_valid_prediction_current_smoker():
    response = client.post(
        "/predict",
        json={
            "RIDAGEYR": 55,
            "SMQ020": 1,
            "SMQ040": 1,
            "MCQ010": 2,
            "BMXBMI": 27.5,
        },
    )

    assert response.status_code == 200
    result = response.json()

    assert 0 <= result["probability"] <= 1
    assert 0 <= result["percent"] <= 100
    assert isinstance(result["prediction_set"], list)
    assert isinstance(result["factors"], list)
    assert len(result["factors"]) == 5
    assert isinstance(result["disclaimer"], str)


def test_valid_prediction_never_smoked():
    response = client.post(
        "/predict",
        json={
            "RIDAGEYR": 45,
            "SMQ020": 2,
            "SMQ040": None,
            "MCQ010": 2,
            "BMXBMI": 24.0,
        },
    )

    assert response.status_code == 200
    result = response.json()

    assert "probability" in result
    assert len(result["factors"]) == 5


def test_current_smoking_answer_required_for_ever_smokers():
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
    assert "error" in response.json()
    assert "probability" not in response.json()


def test_invalid_age_is_rejected():
    response = client.post(
        "/predict",
        json={
            "RIDAGEYR": 19,
            "SMQ020": 1,
            "SMQ040": 1,
            "MCQ010": 2,
            "BMXBMI": 27.5,
        },
    )

    assert response.status_code == 422
