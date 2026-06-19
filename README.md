# Customer Support Chatbot MVP

MVP real de atendimento digital 24/7 com frontend React + Vite, backend Laravel API e banco SQLite. O visual mobile do prototipo foi preservado, mas os chamados agora sao persistidos no backend com protocolo, mensagens, painel de atendente, status e avaliacao.

## Estrutura

```txt
customer-support-chatbot-ui/
|-- frontend/
|   |-- package.json
|   |-- src/
|   |-- index.html
|
|-- backend/
|   |-- app/
|   |-- database/
|   |-- routes/
|   |-- .env.example
|   |-- composer.json
|
|-- README.md
```

## Requisitos

- Node.js 20+
- PHP 8.2+
- Composer
- Extensoes PHP comuns do Laravel, incluindo `pdo_sqlite` e `sqlite3`

## Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

No Windows PowerShell, use:

```powershell
cd backend
composer install
Copy-Item .env.example .env
php artisan key:generate
New-Item -ItemType File -Force database/database.sqlite
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

O seeder cria um admin local:

- email: `admin@local.test`
- senha: `admin123`

Altere essa senha antes de qualquer uso fora do ambiente local.

## Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

No Windows PowerShell:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Variavel principal do frontend:

```env
VITE_API_URL=http://localhost:8000/api
```

Depois de iniciar os dois servidores:

- Atendimento publico: `http://localhost:5173`
- Painel admin: `http://localhost:5173/admin`
- API Laravel: `http://localhost:8000/api`

## Fluxo Publico

1. Usuario abre o atendimento.
2. Seleciona a area.
3. Preenche nome, e-mail, telefone, assunto e descricao.
4. O frontend chama `POST /api/tickets`.
5. O backend grava no SQLite e gera protocolo `MIT-AAAA-000001`.
6. Usuario consulta por protocolo e e-mail.
7. Usuario envia mensagens complementares.
8. Usuario envia avaliacao final, encerrando o chamado.

O `localStorage` ficou apenas para rascunho, ultimo protocolo/e-mail consultado e preferencias locais. A fonte principal dos chamados e o SQLite via API.

## Fluxo Admin

1. Acesse `/admin`.
2. Entre com o admin local.
3. Liste chamados e filtre por status.
4. Abra um chamado.
5. Responda como atendente.
6. Altere status para `open`, `waiting`, `in_progress`, `answered` ou `closed`.

## Endpoints

### Publicos

```txt
POST /api/tickets
GET /api/tickets/lookup?protocol=MIT-2026-000001&email=email@exemplo.com
POST /api/tickets/{protocol}/messages
POST /api/tickets/{protocol}/feedback
```

### Admin

```txt
POST /api/admin/login
POST /api/admin/logout
GET /api/admin/tickets
GET /api/admin/tickets/{id}
PATCH /api/admin/tickets/{id}/status
POST /api/admin/tickets/{id}/messages
```

As rotas admin usam token Bearer retornado pelo login.

## Banco de Dados

As migrations criam:

- `tickets`
- `ticket_messages`
- `ticket_feedback`
- `admin_users`

O SQLite fica em:

```txt
backend/database/database.sqlite
```

Esse arquivo nao deve ser versionado.

## Ponto de Extensao para IA

Ainda nao ha IA integrada. O ponto de extensao esta em:

```txt
backend/app/Services/TicketTriageAdvisor.php
```

Hoje ele usa uma regra deterministica simples para prioridade. No futuro, esse servico pode chamar um provedor de IA sem alterar os controllers.

## Verificacao

Frontend verificado localmente com:

```bash
npm run build
npm run lint
```

Neste ambiente nao foi possivel executar o backend porque PHP e Composer nao estao instalados. Assim que esses requisitos estiverem disponiveis, rode `php artisan migrate --seed` e teste os endpoints.
