# Customer Support Chatbot MVP

MVP real de atendimento digital 24/7 para concursos publicos, com frontend React + Vite, backend Laravel API e banco SQLite. O visual mobile do prototipo foi preservado, mas o atendimento agora posiciona o chat como primeira camada tecnica: ele orienta casos simples, organiza casos complexos e encaminha para uma perita humana quando houver responsabilidade profissional.

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

Variaveis opcionais do backend para IA:

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=
OPENROUTER_MODEL=deepseek/deepseek-r1:free
```

Sem `OPENROUTER_API_KEY`, o sistema usa fallback local deterministico para manter o chat 24/7 funcionando. Com uma chave da OpenRouter e um modelo gratuito `:free`, o endpoint `/api/assistant/chat` consulta a API externa.

Depois de iniciar os dois servidores:

- Atendimento publico: `http://localhost:5173`
- Painel admin: `http://localhost:5173/admin`
- API Laravel: `http://localhost:8000/api`

## Papel do Assistente

O chat atua em tres frentes:

- atendimento sobre concursos publicos: edital, banca, cargo, requisitos, datas, etapas, conteudo programatico, cotas, heteroidentificacao, PCD, pericia medica, TAF e criterios de eliminacao;
- orientacao estrategica: plano de estudos, cronograma, revisoes, metas, simulados, materias fortes/fracas e estrategia de prova;
- triagem tecnica: recurso, revisao de prova, eliminacao, laudo, parecer, nota tecnica e organizacao do caso para analise humana.

O chat pode resolver duvidas simples e operacionais. Casos com laudo, parecer, prova documental sensivel, eliminacao controversa, acao contra banca ou documento assinado sao encaminhados para a perita humana.

## Fluxo Publico

1. Usuario abre o atendimento.
2. Ja encontra o assistente tecnico 24/7 na primeira tela.
3. Escolhe uma frente: edital, estudos, duvida, recurso/revisao, laudo/parecer, acao contra banca ou perita humana.
4. Conversa no chat com indicador de digitacao e resposta rapida do assistente.
5. Preenche nome, e-mail, telefone, assunto, relato, prazo, campos tecnicos e consentimento de dados.
6. Pode anexar documentos. Eles ficam vinculados ao chamado para o admin baixar e analisar.
7. O frontend chama `POST /api/tickets`.
8. O backend grava no SQLite, classifica urgencia por regra deterministica e gera protocolo `MIT-AAAA-000001`.
9. Usuario consulta por protocolo e e-mail.
10. Usuario envia mensagens complementares e novos documentos.
11. Usuario envia avaliacao final, encerrando o chamado.

O `localStorage` ficou apenas para rascunho, ultimo protocolo/e-mail consultado e preferencias locais. A fonte principal dos chamados e o SQLite via API.

## Regras de Seguranca

O assistente nao:

- substitui advogado;
- substitui perita humana;
- assina laudo;
- garante aprovacao;
- promete anulacao de questao;
- promete vitoria judicial;
- inventa fundamento tecnico sem documento;
- conclui caso grave sem provas anexadas.

O formulario publico exige consentimento para tratamento dos dados informados na triagem.

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
POST /api/assistant/chat
POST /api/tickets
GET /api/tickets/lookup?protocol=MIT-2026-000001&email=email@exemplo.com
POST /api/tickets/{protocol}/attachments
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
GET /api/admin/attachments/{id}/download
```

As rotas admin usam token Bearer retornado pelo login.

## Banco de Dados

As migrations criam:

- `tickets`
- `ticket_messages`
- `ticket_attachments`
- `ticket_feedback`
- `admin_users`

O SQLite fica em:

```txt
backend/database/database.sqlite
```

Esse arquivo nao deve ser versionado.

## IA e Ponto de Extensao

O ponto de extensao esta em:

```txt
backend/app/Services/AssistantChatService.php
backend/app/Services/TicketTriageAdvisor.php
```

`AssistantChatService` tenta usar OpenRouter quando `OPENROUTER_API_KEY` esta configurada. Se a API gratuita estiver indisponivel, sem chave ou rate-limited, ele responde com fallback local. `TicketTriageAdvisor` usa uma regra deterministica simples para prioridade, com sinais como prazo, recurso, eliminacao, laudo, parecer, TAF, PCD, heteroidentificacao, pericia medica e possivel medida judicial.

## Verificacao

Frontend verificado com:

```bash
npm run build
npm run lint
```

Backend verificado com:

```bash
php artisan route:list
php artisan migrate --seed
```

No ambiente Windows testado, o PHP estava instalado pelo Laragon. Se `php` nao estiver no PATH, use o terminal do Laragon ou o caminho completo do executavel PHP.
