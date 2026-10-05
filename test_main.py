import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Cada teste usa um banco novo e temporário, sem tocar no tarefas.db real.
    monkeypatch.setattr(main, "DB_PATH", str(tmp_path / "teste.db"))
    with TestClient(main.app) as c:  # o "with" dispara o lifespan (cria a tabela)
        yield c


def test_fluxo_completo(client):
    r = client.post("/tarefas", json={"titulo": "Estudar"})
    assert r.status_code == 201
    tarefa = r.json()
    assert tarefa["concluida"] is False

    assert client.get(f"/tarefas/{tarefa['id']}").json()["titulo"] == "Estudar"

    r = client.put(f"/tarefas/{tarefa['id']}", json={"titulo": "Estudar", "concluida": True})
    assert r.json()["concluida"] is True
    assert client.get(f"/tarefas/{tarefa['id']}").json()["concluida"] is True

    assert client.delete(f"/tarefas/{tarefa['id']}").status_code == 204
    assert client.get(f"/tarefas/{tarefa['id']}").status_code == 404


def test_listar(client):
    client.post("/tarefas", json={"titulo": "A"})
    client.post("/tarefas", json={"titulo": "B"})
    assert [t["titulo"] for t in client.get("/tarefas").json()] == ["A", "B"]


def test_atualizar_inexistente(client):
    r = client.put("/tarefas/999", json={"titulo": "X"})
    assert r.status_code == 404


def test_validacao(client):
    assert client.post("/tarefas", json={}).status_code == 422
