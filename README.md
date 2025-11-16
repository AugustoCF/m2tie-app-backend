# 📋 M2TIE - Sistema de Formulários | Backend

> API RESTful para gerenciamento de formulários dinâmicos com autenticação JWT e MongoDB.

[![Node.js](https://img.shields.io/badge/Node.js-24.x-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.x-green.svg)](https://www.mongodb.com/)
[![Swagger](https://img.shields.io/badge/Swagger-OpenAPI%203.0-green.svg)](http://localhost:8000/api/docs)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

---

## 🚀 Início Rápido

### Pré-requisitos
- Node.js == 24.11.1
- MongoDB >= 4.4

### Instalação

```bash
# Clone o repositório
git clone https://github.com/AugustoCF/m2tie-app-backend.git
cd m2tie-app-backend

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Inicie o servidor
npm start
```

Servidor rodando em `http://localhost:8000`

---

## 📖 Documentação da API

### 🎯 **Swagger UI (Recomendado)**
Acesse a documentação interativa completa:

```
http://localhost:8000/api/docs
```

**Recursos:**
- ✅ Teste todos os endpoints diretamente no navegador
- ✅ Visualize schemas de request/response
- ✅ Autenticação JWT integrada
- ✅ Exemplos de uso para cada endpoint

---

## 🛠️ Tecnologias

- **Node.js** + **Express.js** - Backend framework
- **MongoDB** + **Mongoose** - Banco de dados
- **JWT** - Autenticação
- **Bcrypt** - Criptografia de senhas
- **Swagger** - Documentação da API

---

## 📂 Estrutura

```
Backend/
├── models/          # Schemas (User, Form, Question, Response)
├── routes/          # Rotas da API
├── helpers/         # Autenticação e validação
├── swagger.js       # Configuração Swagger
├── .env.example     # Template de variáveis
└── server.js        # Entry point
```

---

## 🔌 Endpoints Principais

| Categoria | Endpoint | Descrição |
|-----------|----------|-----------|
| **Auth** | `POST /api/auth/register` | Registrar usuário |
| **Auth** | `POST /api/auth/login` | Login |
| **Users** | `GET /api/users` | Listar usuários |
| **Questions** | `POST /api/questions` | Criar questão |
| **Forms** | `POST /api/forms` | Criar formulário |
| **Responses** | `POST /api/responses` | Submeter resposta |
| **Dashboards** | `GET /api/dashboards/full-analysis/:formId` | Análise completa |

**📚 [Ver documentação completa no Swagger](http://localhost:8000/api/docs)**

---

## 🔒 Autenticação

Todas as rotas (exceto registro e login) requerem autenticação JWT.

**No Swagger:**
1. Faça login em `/api/auth/login`
2. Copie o token retornado
3. Clique em "Authorize" no topo
4. Cole o token (sem "Bearer")

---

## 🧪 Testando a API

### Opção 1: Swagger UI ⭐
```
http://localhost:8000/api/docs
```

### Opção 2: cURL
```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@email.com","password":"senha123"}'

# Listar formulários
curl -X GET http://localhost:8000/api/forms \
  -H "auth-token: SEU_TOKEN_AQUI"
```

---

## 📊 Variáveis de Ambiente

```env
PORT=numero_da_porta
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=m2tie
SECRET=seu_secret_jwt
```

---

## 📝 Licença

ISC © 2025 Augusto Freitas

---

<p align="center">Desenvolvido com ❤️ para o TCC | 2025</p>