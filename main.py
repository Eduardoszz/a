from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="API de Tarefas")


class TarefaIn(BaseModel):
    titulo: str
    concluida: bool = False


class Tarefa(TarefaIn):
    id: int


# "Banco de dados" em memória: some quando o servidor reinicia.
tarefas: dict[int, Tarefa] = {}
proximo_id = 1


@app.get("/tarefas", response_model=list[Tarefa])
def listar():
    return list(tarefas.values())


@app.get("/tarefas/{tarefa_id}", response_model=Tarefa)
def obter(tarefa_id: int):
    if tarefa_id not in tarefas:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    return tarefas[tarefa_id]


@app.post("/tarefas", response_model=Tarefa, status_code=201)
def criar(dados: TarefaIn):
    global proximo_id
    tarefa = Tarefa(id=proximo_id, **dados.model_dump())
    tarefas[tarefa.id] = tarefa
    proximo_id += 1
    return tarefa


@app.put("/tarefas/{tarefa_id}", response_model=Tarefa)
def atualizar(tarefa_id: int, dados: TarefaIn):
    if tarefa_id not in tarefas:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    tarefas[tarefa_id] = Tarefa(id=tarefa_id, **dados.model_dump())
    return tarefas[tarefa_id]


@app.delete("/tarefas/{tarefa_id}", status_code=204)
def remover(tarefa_id: int):
    if tarefa_id not in tarefas:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    del tarefas[tarefa_id]
