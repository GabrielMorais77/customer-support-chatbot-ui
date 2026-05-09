# Customer Support Chatbot UI

Prototipo de uma interface web para atendimento digital 24/7, desenvolvida em React com foco em experiencia mobile, navegacao funcional e organizacao modular para futuras integracoes com APIs, IA e sistemas reais de suporte.

## 1. Objetivo do projeto

O projeto simula uma central de atendimento digital para Mitsue Borges, com enfase em:

- triagem inicial de demandas;
- organizacao de chamados e protocolos;
- acompanhamento de fila e status;
- experiencia visual inspirada em aplicativos mobile modernos;
- base tecnica preparada para evolucao futura.

## 2. Visao geral da interface

A aplicacao apresenta uma unica interface funcional em formato de smartphone, com navegacao interna entre etapas do atendimento:

- abertura do atendimento;
- pagina institucional;
- assistente virtual;
- identificacao do solicitante;
- lista de chamados;
- fila de atendimento;
- detalhes do chamado;
- avaliacao;
- comentario final.

## 3. Estrutura principal do projeto

Estrutura resumida:

```text
customer-support-chatbot-ui/
|-- public/
|-- src/
|   |-- App.jsx
|   |-- main.jsx
|   |-- index.css
|   |-- chatbot_highfi_interactive.jsx
|   |-- chatbot_highfi_interactive.css
|   `-- features/
|       `-- mitsue-assistant/
|           |-- ChatbotPrototype.jsx
|           |-- config.js
|           |-- storage.js
|           |-- utils.js
|           `-- components/
|               |-- ChatField.jsx
|               `-- MessageBubble.jsx
|-- index.html
|-- package.json
`-- README.md
```

## 4. Execucao local

```bash
npm install
npm run dev
```

Para gerar a versao de producao:

```bash
npm run build
```

## 5. Funcionalidades implementadas

As funcionalidades implementadas no prototipo incluem:

- interface responsiva com simulacao de aplicativo mobile;
- central unica de atendimento com navegacao funcional entre etapas;
- pagina inicial com destaque visual e botao principal de inicio do atendimento;
- botao "Iniciar atendimento" com destaque visual e microinteracoes;
- selo visual de atendimento "24/7" para reforco de disponibilidade;
- tela de chat com layout completo, mensagens, campo de digitacao e envio;
- fluxo de identificacao do usuario antes do acompanhamento do chamado;
- area de "Meus chamados" com consulta de protocolos e abertura de detalhes;
- tela de fila de atendimento com status, ordem de espera e envio de mensagens;
- tela de detalhes do chamado, avaliacao e comentario final;
- organizacao modular em componentes React, utilitarios e camada de persistencia local.

## 6. Fluxos principais simulados

Nesta secao sao descritos os fluxos principais simulados no prototipo, evidenciando sua navegabilidade e funcionamento.

### 6.1 Fluxo 01 - Entrada no sistema

- o usuario acessa a aplicacao pela URL disponibilizada;
- o sistema exibe a tela inicial com destaque para o atendimento digital;
- o usuario visualiza o call-to-action principal e o selo de disponibilidade 24/7.

### 6.2 Fluxo 02 - Iniciar atendimento

- o usuario clica no botao "Iniciar atendimento";
- o sistema direciona para a interface principal do assistente;
- a tela apresenta conversa inicial, areas de atendimento e formulario reduzido de triagem.

### 6.3 Fluxo 03 - Triagem e identificacao

- o usuario seleciona a area da demanda;
- informa dados basicos, resumo do caso e, quando necessario, dados tecnicos;
- pode anexar documentos para pre-analise;
- em seguida escolhe entre se identificar ou continuar como visitante.

### 6.4 Fluxo 04 - Acompanhamento de chamados

- apos a triagem, o sistema gera um protocolo de atendimento;
- o usuario acessa a area "Meus chamados";
- visualiza protocolos, status, area relacionada e opcoes para abrir detalhes ou fila.

### 6.5 Fluxo 05 - Fila, detalhes e retorno

- o usuario acompanha a fila de atendimento;
- pode enviar mensagem complementar durante a espera;
- acessa os detalhes do chamado com resumo, status e prazo estimado de retorno.

### 6.6 Fluxo 06 - Avaliacao e comentario final

- ao concluir a navegacao, o usuario pode avaliar a experiencia;
- o sistema permite registrar nota, estrelas e comentario complementar;
- as informacoes ficam vinculadas ao chamado no historico local do prototipo.

## 7. Tecnologias utilizadas

As tecnologias utilizadas para construcao do prototipo foram:

- React - biblioteca JavaScript para construcao de interfaces modernas;
- Vite - ferramenta de build e desenvolvimento rapido para projetos frontend;
- CSS customizado com variaveis e componentes visuais proprios;
- lucide-react - biblioteca de icones modernos para compor a interface;
- localStorage - utilizado para persistencia local de rascunhos, protocolos e historico;
- ESLint - utilizado para validacao e padrao minimo de qualidade do codigo.

### 7.1 Observacao tecnica

Neste projeto, a interface atual foi estilizada com CSS customizado, sem dependencia de CDN para o layout principal. A persistencia tambem foi mantida localmente no navegador, o que e adequado para prototipos navegaveis e provas de conceito. Em uma evolucao futura, recomenda-se integrar backend real, autenticacao, banco de dados e servicos externos de atendimento.
