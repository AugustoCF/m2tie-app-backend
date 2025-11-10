# 📋 M2TIE - Sistema de Formulários | Backend

> API RESTful para gerenciamento de formulários dinâmicos com autenticação JWT e MongoDB.

[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.x-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

---

## 🚀 Início Rápido

### Pré-requisitos
- Node.js >= 18.0.0
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

## 🛠️ Tecnologias

- **Node.js** + **Express.js** - Backend framework
- **MongoDB** + **Mongoose** - Banco de dados
- **JWT** - Autenticação
- **Bcrypt** - Criptografia de senhas

---

## 📂 Estrutura

```
Backend/
├── models/          # Schemas (User, Form, Question, Response)
├── routes/          # Rotas da API
├── middleware/      # Autenticação e validação
├── .env.example     # Template de variáveis
└── server.js        # Entry point
```

---

## 🔌 API Endpoints

### Autenticação

**Registrar Usuário**
```http
POST /api/auth/register
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "senha123",
  "confirmpassword": "senha123",
  "role": "user"
}
```

**Resposta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "...", "name": "...", "role": "..." }
}
```

### Outros Endpoints *(em desenvolvimento)*
- `GET/POST /api/forms` - Gerenciar formulários
- `GET/POST /api/questions` - Gerenciar questões
- `POST /api/responses` - Submeter respostas

---

## 🗄️ Modelos de Dados

**User** - Usuários do sistema (admin, staff, user)  
**Question** - Questões reutilizáveis (text, multiple_choice, etc.)  
**Form** - Formulários com questões vinculadas  
**Response** - Respostas dos usuários aos formulários

---

## ⚙️ Variáveis de Ambiente

```env
JWT_SECRET=sua-chave-secreta-aqui
PORT=
DB_NAME=
```

## 🔒 Segurança

- ✅ Hash de senhas com Bcrypt
- ✅ Autenticação JWT (expiração 24h)
- ✅ Validação de entrada
- ✅ CORS habilitado
- ✅ Variáveis sensíveis em `.env`

---

## 🚧 Roadmap

- [x] Autenticação JWT
- [x] Modelos de Dados
- [ ] CRUD de Formulários
- [ ] Sistema de Respostas
- [ ] Análise de Dados
- [ ] Testes Automatizados
- [ ] Documentação Swagger

---

## 📄 Licença

Este projeto está sob a licença ISC.

---

## 📧 Contato

**Augusto Freitas**  
GitHub: [@AugustoCF](https://github.com/AugustoCF)

---

<p align="center">Desenvolvido com ❤️ para o TCC | 2025</p>