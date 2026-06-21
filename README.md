# Customer Support Chatbot UI

MVP de assistente tecnico para concursos publicos com frontend React + Vite, backend Laravel API, MySQL/TiDB Cloud e base para indexacao de editais em PDF. A tela publica abre em modo Desktop por padrao, com alternancia para o modo Mobile que preserva a moldura de celular do prototipo.

## Estrutura

```txt
customer-support-chatbot-ui/
|-- frontend/                 React + Vite
|-- backend/                  Laravel API
|-- scripts/                  Indexador Python de editais
|-- README.md
```

## Requisitos

- Node.js 20+
- PHP 8.2+
- Composer
- MySQL/TiDB Cloud acessivel pela maquina local
- Python 3.10+
- Chave Gemini criada no Google AI Studio

## Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Variavel esperada:

```env
VITE_API_URL=http://127.0.0.1:8000/api
```

Rotas principais:

- `http://127.0.0.1:5173` atendimento publico
- `http://127.0.0.1:5173/admin` painel admin existente

## Backend

```powershell
cd backend
composer install
Copy-Item .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

Configure `backend/.env` sem versionar segredos:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-2

DB_CONNECTION=mysql
DB_HOST=
DB_PORT=
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=
MYSQL_ATTR_SSL_CA=
MYSQL_SSL_VERIFY=false
```

O projeto tambem aceita os nomes legados `HOST`, `PORT`, `DATABASE`, `USERNAME` e `PASSWORD` para nao quebrar ambientes locais existentes, mas o padrao recomendado e `DB_*`.

TiDB Cloud Serverless exige conexao TLS. No Windows, baixe o certificado publico ISRG Root X1 e aponte `MYSQL_ATTR_SSL_CA` para o arquivo local:

```powershell
New-Item -ItemType Directory -Force backend\storage\certs
Invoke-WebRequest -Uri "https://letsencrypt.org/certs/isrgrootx1.pem" -OutFile "backend\storage\certs\isrgrootx1.pem"
```

Depois configure:

```env
MYSQL_ATTR_SSL_CA=C:/caminho/para/backend/storage/certs/isrgrootx1.pem
MYSQL_SSL_VERIFY=false
```

## Banco

As migrations criam:

- `tickets`, `ticket_messages`, `ticket_attachments`, `ticket_feedback`, `admin_users`
- `concursos`
- `edital_documentos`
- `edital_chunks`
- `concurso_resumos`
- `chat_sessions`
- `chat_messages`
- `concursos_editais`

`edital_chunks.embedding` armazena o vetor em JSON para o MVP. A migration tenta criar indice FULLTEXT em `edital_chunks.texto` quando o driver MySQL/TiDB permitir; se nao permitir, o sistema segue usando fallback por embeddings recentes.

`concursos_editais` e o catalogo estruturado rapido usado pelo chat para perguntas como editais abertos, prazos, cargos, banca, salario, escolaridade e planos de estudo iniciais. Essa tabela e criada pela migration `2026_06_20_000005_create_concursos_editais_table.php` e ja vem populada com registros iniciais.

## Chat com Editais

Endpoint:

```txt
POST /api/chat-concursos
```

Exemplo:

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/chat-concursos `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"pergunta":"Qual e o prazo de inscricao e o valor da taxa?","option":"tirar_duvida_simples"}'
```

Resposta esperada:

```json
{
  "success": true,
  "session_id": "uuid",
  "resposta": "...",
  "fontes_usadas": [
    {
      "score": 0.8123,
      "concurso": "...",
      "orgao": "...",
      "banca": "...",
      "url_oficial": "..."
    }
  ]
}
```

O `GeminiService` usa `GEMINI_API_KEY` e o header `x-goog-api-key`. A ordem de consulta e:

1. Buscar primeiro no catalogo `concursos_editais`.
2. Para listas objetivas de editais abertos, responder deterministicamente com os registros do banco.
3. Para analise de edital e plano de estudos, enviar ao Gemini um prompt com os concursos encontrados no catalogo.
4. Se o catalogo nao resolver, gerar embedding da pergunta, buscar chunks candidatos, calcular similaridade cosseno em PHP e chamar `gemini-2.5-flash` com os trechos recuperados.
5. Se nada for localizado, pedir link/PDF ou orientar sem inventar dados de edital.

## Indexador Python

Instale dependencias:

```powershell
cd scripts
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

O script le `backend/.env`, `.env` na raiz ou `scripts/.env`. Variaveis esperadas:

```env
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
DB_HOST=
DB_PORT=
DB_DATABASE=
DB_USERNAME=
DB_PASSWORD=
```

Rodando com argumentos:

```powershell
python .\indexar_edital.py `
  --titulo "Concurso exemplo" `
  --orgao "Orgao exemplo" `
  --banca "Banca exemplo" `
  --uf "SP" `
  --url-oficial "https://exemplo.gov.br/concurso" `
  --url-pdf "https://exemplo.gov.br/edital.pdf"
```

O indexador baixa o PDF, calcula SHA-256, evita duplicar `hash_documento`, extrai texto com PyMuPDF, divide em chunks, gera embeddings com Gemini Embedding e salva em MySQL/TiDB. PDFs sem texto extraivel geram erro claro indicando necessidade de OCR.

## Fluxo Publico

- Desktop abre por padrao como um site com balcao digital e chat ja visivel.
- O botao Desktop/Mobile alterna a experiencia.
- Mobile preserva a moldura de celular do prototipo.
- `Tirar duvida simples`, `Analisar edital e regras` e `Montar plano de estudos` abrem conversa direta com a IA de editais.
- `Quero abrir protocolo`, `Anexar documento`, `Recurso ou revisao`, `Laudo ou parecer`, `Caso contra banca` e `Encaminhar a perita` abrem coleta guiada e reutilizam o fluxo de chamados.

## n8n

n8n nao e obrigatorio para rodar o MVP. Ele pode ser usado depois como automacao self-hosted opcional para tarefas como agendar crawlers, avisar equipe sobre novos protocolos ou sincronizar documentos externos.

## Seguranca

- Nao versionar `.env`.
- Nao colocar host, usuario, senha ou chave real no README, codigo ou commits.
- O assistente nao deve inventar dados de edital.
- Laudo, parecer, acao contra banca e casos sensiveis seguem para atendimento humano/protocolo.
