from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_fluxo_completo():
    r = client.post("/tarefas", json={"titulo": "Estudar"})
    assert r.status_code == 201
    tarefa = r.json()
    assert tarefa["concluida"] is False

    assert client.get(f"/tarefas/{tarefa['id']}").json()["titulo"] == "Estudar"

    r = client.put(f"/tarefas/{tarefa['id']}", json={"titulo": "Estudar", "concluida": True})
    assert r.json()["concluida"] is True

    assert client.delete(f"/tarefas/{tarefa['id']}").status_code == 204
    assert client.get(f"/tarefas/{tarefa['id']}").status_code == 404


def test_validacao():
    assert client.post("/tarefas", json={}).status_code == 422
