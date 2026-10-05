import os
import sqlite3
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

# Arquivo do banco. Pode ser trocado pela variável de ambiente TAREFAS_DB.
DB_PATH = os.getenv("TAREFAS_DB", "tarefas.db")


def conectar() -> sqlite3.Connection:
    # check_same_thread=False: o FastAPI pode usar a conexão em threads diferentes.
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row  # permite acessar colunas por nome: row["titulo"]
    return conn


def criar_tabela():
    conn = conectar()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tarefas (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo    TEXT NOT NULL,
            concluida INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.commit()
    conn.close()


def get_db():
    # Uma conexão por requisição, fechada no final (mesmo se der erro).
    conn = conectar()
    try:
        yield conn
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    criar_tabela()  # roda uma vez quando o servidor sobe
    yield


app = FastAPI(title="API de Tarefas", lifespan=lifespan)


class TarefaIn(BaseModel):
    titulo: str
    concluida: bool = False


class Tarefa(TarefaIn):
    id: int


def linha_para_tarefa(linha: sqlite3.Row) -> Tarefa:
    return Tarefa(
        id=linha["id"], titulo=linha["titulo"], concluida=bool(linha["concluida"])
    )


def buscar_ou_404(db: sqlite3.Connection, tarefa_id: int) -> sqlite3.Row:
    linha = db.execute("SELECT * FROM tarefas WHERE id = ?", (tarefa_id,)).fetchone()
    if linha is None:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    return linha


@app.get("/tarefas", response_model=list[Tarefa])
def listar(db: sqlite3.Connection = Depends(get_db)):
    linhas = db.execute("SELECT * FROM tarefas ORDER BY id").fetchall()
    return [linha_para_tarefa(l) for l in linhas]


@app.get("/tarefas/{tarefa_id}", response_model=Tarefa)
def obter(tarefa_id: int, db: sqlite3.Connection = Depends(get_db)):
    return linha_para_tarefa(buscar_ou_404(db, tarefa_id))


@app.post("/tarefas", response_model=Tarefa, status_code=201)
def criar(dados: TarefaIn, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.execute(
        "INSERT INTO tarefas (titulo, concluida) VALUES (?, ?)",
        (dados.titulo, int(dados.concluida)),
    )
    db.commit()
    return Tarefa(id=cursor.lastrowid, **dados.model_dump())


@app.put("/tarefas/{tarefa_id}", response_model=Tarefa)
def atualizar(tarefa_id: int, dados: TarefaIn, db: sqlite3.Connection = Depends(get_db)):
    buscar_ou_404(db, tarefa_id)
    db.execute(
        "UPDATE tarefas SET titulo = ?, concluida = ? WHERE id = ?",
        (dados.titulo, int(dados.concluida), tarefa_id),
    )
    db.commit()
    return Tarefa(id=tarefa_id, **dados.model_dump())


@app.delete("/tarefas/{tarefa_id}", status_code=204)
def remover(tarefa_id: int, db: sqlite3.Connection = Depends(get_db)):
    buscar_ou_404(db, tarefa_id)
    db.execute("DELETE FROM tarefas WHERE id = ?", (tarefa_id,))
    db.commit()
