# Customer Support Chatbot UI

Protótipo de alta fidelidade de uma **interface de chatbot para atendimento 24/7**, desenvolvido em **React + Vite**, com layout inspirado em um aplicativo mobile e foco em experiência do usuário (UX) para atendimento digital.

O objetivo principal deste projeto é explorar, na prática, conceitos de **frontend moderno**, **componentização** e **design de interfaces de atendimento**, ao mesmo tempo em que revisito tecnologias do meu dia a dia.

---

## 🎯 Visão geral

Este projeto simula uma experiência de:

- Página inicial com **hero de destaque** e call-to-action claro (“Iniciar atendimento”);
- Interface de **chat em formato de smartphone**, centralizada na tela;
- Destaque visual para atendimento **24/7**;
- Layout construído com **Tailwind CSS (via CDN)** para ganho de produtividade na fase de prototipagem.

Apesar de ser um protótipo, a estrutura foi pensada para ser facilmente evoluída para um produto real.

---

## 🧩 Funcionalidades principais

- **Layout responsivo** com foco na simulação de um app mobile de atendimento;
- **Botão de início de atendimento** em destaque, com gradiente e microinterações visuais;
- **Selo 24/7** para reforço de valor do serviço;
- Componentes React organizados para facilitar evolução futura (fluxos de conversa, estados do chat, etc.);
- Estrutura pronta para integração futura com backends, APIs de IA ou plataformas de chatbot.

---

## 🛠️ Stack e tecnologias

- **React** (com Vite) – ambiente leve e moderno de desenvolvimento;
- **Vite** – bundler e dev server rápido;
- **Tailwind CSS (via CDN)** – utilizado aqui para:
  - acelerar a construção do layout,
  - testar rapidamente variações de design,
  - iterar no protótipo sem overhead de build de CSS;
- **lucide-react** – biblioteca de ícones modernos para compor a interface.

> 💡 **Curiosidade técnica:**  
> Neste projeto, optei por usar **Tailwind CSS via CDN** em vez da configuração completa com PostCSS e build. Essa abordagem é excelente para **protótipos rápidos** e provas de conceito, permitindo testar ideias de UI em minutos. Em um cenário de produção, a migração para a versão “oficial” com árvore de classes purgada e build otimizado é simples e recomendada.

---

## 🧱 Estrutura do projeto

Estrutura simplificada das pastas principais:

```bash
customer-support-chatbot-ui/
├─ public/
├─ src/
│  ├─ App.jsx
│  ├─ main.jsx
│  ├─ chatbot_highfi_interactive.jsx   # Componente principal do protótipo
│  └─ index.css                        # Estilos globais/reset
├─ index.html                          # Entrada HTML com Tailwind via CDN
├─ package.json
└─ README.md
