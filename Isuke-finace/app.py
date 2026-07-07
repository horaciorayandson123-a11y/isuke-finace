import sqlite3
import bcrypt
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Sistema de Controle Financeiro - Isuke Aoki")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "banco_financas.db"

def iniciar_banco():
    conexao = sqlite3.connect(DB_NAME)
    cursor = conexao.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            valor REAL NOT NULL,
            descricao TEXT,
            data TEXT NOT NULL,
            FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        )
    """)
    conexao.commit()
    conexao.close()

iniciar_banco()

# Modelos
class UsuarioCadastro(BaseModel):
    nome: str
    email: str
    senha: str

class UsuarioLogin(BaseModel):
    email: str
    senha: str

class TransacaoCadastro(BaseModel):
    usuario_id: int
    tipo: str
    valor: float
    descricao: Optional[str] = None
    data: str

# --- NOVAS ROTAS DE SEGURANÇA ---

@app.post("/usuarios/cadastro")
def cadastrar_usuario(usuario: UsuarioCadastro):
    conexao = sqlite3.connect(DB_NAME)
    cursor = conexao.cursor()
    
    # É AQUI QUE O HACKER CHORA: Criptografando a senha antes de salvar
    bytes_senha = usuario.senha.encode('utf-8')
    sal = bcrypt.gensalt()
    senha_criptografada = bcrypt.hashpw(bytes_senha, sal).decode('utf-8')
    
    try:
        cursor.execute(
            "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
            (usuario.nome, usuario.email, senha_criptografada)
        )
        conexao.commit()
        return {"msg": "Usuário criado com sucesso!"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado.")
    finally:
        conexao.close()

@app.post("/usuarios/login")
def login_usuario(usuario: UsuarioLogin):
    conexao = sqlite3.connect(DB_NAME)
    cursor = conexao.cursor()
    
    cursor.execute("SELECT id, nome, senha FROM usuarios WHERE email = ?", (usuario.email,))
    resultado = cursor.fetchone()
    conexao.close()
    
    if not resultado:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
        
    usuario_id, nome, senha_hash_banco = resultado
    
    # Verifica se a senha digitada bate com o hash salvo no banco
    if bcrypt.checkpw(usuario.senha.encode('utf-8'), senha_hash_banco.encode('utf-8')):
        return {"msg": "Login autorizado!", "usuario_id": usuario_id, "nome": nome}
    else:
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

# --- ROTAS DE TRANSAÇÕES (IGUAIS ANTERIORES) ---

@app.post("/transacoes")
def criar_transacao(transacao: TransacaoCadastro):
    conexao = sqlite3.connect(DB_NAME)
    cursor = conexao.cursor()
    cursor.execute(
        "INSERT INTO transacoes (usuario_id, tipo, valor, descricao, data) VALUES (?, ?, ?, ?, ?)",
        (transacao.usuario_id, transacao.tipo, transacao.valor, transacao.descricao, transacao.data)
    )
    conexao.commit()
    conexao.close()
    return {"msg": "Movimentação registrada!"}

@app.get("/transacoes/{usuario_id}")
def listar_transacoes_do_usuario(usuario_id: int):
    conexao = sqlite3.connect(DB_NAME)
    cursor = conexao.cursor()
    cursor.execute("SELECT id, tipo, valor, descricao, data FROM transacoes WHERE usuario_id = ?", (usuario_id,))
    dados = cursor.fetchall()
    conexao.close()
    
    lista_formatada = []
    for linha in dados:
        lista_formatada.append({"id": linha[0], "tipo": linha[1], "valor": linha[2], "descricao": linha[3], "data": linha[4]})
    return lista_formatada