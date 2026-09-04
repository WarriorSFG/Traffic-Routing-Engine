"""Tests for Flask REST API Dashboard Server.
Validates simulation, benchmarking, and dynamic incident rerouting endpoints.
"""

import pytest
from traffic_routing.dashboard.server import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"


def test_simulate_endpoint(client):
    payload = {
        "preset": "Rush-Hour Bottleneck",
        "sim_clock": 8.0,
        "num_customers": 10,
        "num_vehicles": 3,
        "vehicle_cap": 100.0,
        "swarm_size": 20,
        "max_iter": 40,
        "seed": 42
    }
    res = client.post("/api/simulate", json=payload)
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data["success"] is True
    data = json_data["data"]

    # Check metrics
    assert "metrics" in data
    assert data["metrics"]["num_customers"] == 10
    assert data["metrics"]["total_vehicles"] == 3
    assert data["metrics"]["compute_time_ms"] > 0

    # Check network geometry
    assert len(data["edges"]) > 0
    assert len(data["customers"]) == 10
    assert "depot" in data
    assert len(data["routes"]) > 0


def test_benchmark_endpoint(client):
    payload = {
        "num_runs": 1,
        "swarm_size": 15,
        "max_iter": 30,
        "seed": 42
    }
    res = client.post("/api/benchmark", json=payload)
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data["success"] is True
    data = json_data["data"]

    assert "scorecard" in data
    assert len(data["scorecard"]) >= 3  # GNN, PSO, QPSO
    assert "convergence" in data
    assert len(data["convergence"]) > 0


def test_reroute_endpoint(client):
    res = client.post("/api/reroute")
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data["success"] is True
    data = json_data["data"]

    assert "disrupted_edge" in data
    assert "prior" in data
    assert "rerouted" in data
    assert data["rerouted"]["compute_time_ms"] > 0
