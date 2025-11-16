import { MessageCircle, Minus, Paperclip, Send, Star, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function ChatbotPrototype() {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const [rating, setRating] = useState(0);
  const [queuePosition, setQueuePosition] = useState(2);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Tickets mock data
  const tickets = [
    {
      id: '12345',
      title: 'Suporte técnico',
      status: 'Em análise',
      statusColor: 'text-orange-500',
      lastUpdate: 'Ontem, 15:32',
      description: 'Você informou que não consegue acessar o sistema.',
      deadline: '18/11/2025'
    },
    {
      id: '12344',
      title: 'Fatura em duplicidade',
      status: 'Resolvido',
      statusColor: 'text-green-500',
      lastUpdate: '10/11/2025, 09:10',
      description: 'Problema de cobrança duplicada.',
      deadline: 'Finalizado'
    }
  ];

  const addMessage = (text, isBot = true, type = 'text', data = null) => {
    setMessages(prev => [...prev, { text, isBot, type, data, timestamp: new Date() }]);
  };

  const handleOpenChat = () => {
    setChatOpen(true);
    if (messages.length === 0) {
      setTimeout(() => {
        addMessage('Olá! Sou o assistente virtual. Estou aqui 24/7 para te ajudar. 👋');
      }, 300);
      setTimeout(() => {
        addMessage('Seus dados podem ser usados para registrar o atendimento conforme nossa política de privacidade.');
      }, 1000);
      setTimeout(() => {
        addMessage('Como posso te ajudar hoje?', true, 'quickReplies');
      }, 1500);
    }
  };

  const handleQuickReply = (option) => {
    addMessage(option, false);
    
    setTimeout(() => {
      switch(option) {
        case '📦 Meus pedidos':
          if (!isAuthenticated) {
            addMessage('Para consultar seus pedidos, preciso confirmar sua identidade. Você quer se autenticar agora?', true, 'auth');
          } else {
            addMessage(`Olá ${userName}! Aqui estão seus últimos pedidos...`);
          }
          break;
        case '💳 Financeiro':
          addMessage('Vou te ajudar com questões financeiras. O que você precisa?');
          break;
        case '🛠 Suporte técnico':
          addMessage('Entendi! Vou te ajudar com suporte técnico. Qual é o problema?');
          break;
        case '📄 Abrir chamado':
          addMessage('Vamos abrir um novo chamado. Descreva brevemente o problema:');
          break;
        case '👤 Falar com atendente':
          handleTransferToHuman();
          break;
        case '🔍 Ver meus chamados':
          handleShowTickets();
          break;
        default:
          addMessage('Entendi! Como posso te ajudar com isso?');
      }
    }, 800);
  };

  const handleAuth = (option) => {
    if (option === 'login') {
      addMessage('Entrar com minha conta', false);
      setTimeout(() => {
        addMessage('Por favor, insira suas credenciais:', true, 'loginForm');
      }, 500);
    } else {
      addMessage('Continuar sem identificar', false);
      setTimeout(() => {
        addMessage('Tudo bem! Posso te ajudar com informações gerais. Como posso ajudar?');
      }, 500);
    }
  };

  const handleLogin = () => {
    if (loginEmail && loginPassword) {
      const name = loginEmail.split('@')[0];
      setUserName(name);
      setIsAuthenticated(true);
      setLoginEmail('');
      setLoginPassword('');
      
      addMessage('Autenticação realizada', false);
      setTimeout(() => {
        addMessage(`Pronto, ${name}! Já estou com seus dados. O que você quer fazer agora?`, true, 'authenticatedOptions');
      }, 800);
    }
  };

  const handleShowTickets = () => {
    addMessage('Ver meus chamados', false);
    setTimeout(() => {
      addMessage('Aqui estão seus chamados em aberto:', true, 'ticketList', tickets);
    }, 600);
  };

  const handleTicketDetails = (ticket) => {
    addMessage(`Ver detalhes do chamado #${ticket.id}`, false);
    setTimeout(() => {
      addMessage('', true, 'ticketDetails', ticket);
    }, 500);
  };

  const handleTransferToHuman = () => {
    addMessage('Falar com atendente', false);
    setTimeout(() => {
      addMessage('Vou te transferir para um atendente humano. Tempo estimado de espera: ~3 minutos', true, 'queue');
    }, 600);

    // Simula diminuição da fila
    const queueInterval = setInterval(() => {
      setQueuePosition(prev => {
        if (prev <= 1) {
          clearInterval(queueInterval);
          setTimeout(() => {
            addMessage('', true, 'humanJoined');
            setTimeout(() => {
              addMessage('Olá! Sou a Maria, atendente humana. Como posso ajudar você hoje?', true, 'human');
            }, 800);
          }, 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 3000);
  };
  const handleEndChat = () => {
    addMessage('Encerrar atendimento', false);
    setTimeout(() => {
      addMessage('Antes de encerrar, como você avalia o atendimento de hoje?', true, 'csat');
    }, 600);
  };

  const handleRatingSubmit = () => {
    if (rating > 0) {
      addMessage(`Avaliação: ${rating} estrelas`, false);
      setTimeout(() => {
        addMessage('Obrigado! Seu feedback ajuda a melhorar nosso atendimento. 👋', true);
        setTimeout(() => {
          addMessage('Se precisar de algo, é só chamar novamente. Estou disponível 24/7! 😊', true);
        }, 1000);
      }, 500);
    }
  };

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      addMessage(inputValue, false);
      setInputValue('');
      
      // Simula resposta do bot
      setTimeout(() => {
        addMessage('Entendi! Vou processar sua solicitação...');
        setTimeout(() => {
          addMessage('Como posso te ajudar mais?', true, 'quickReplies');
        }, 1500);
      }, 800);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessage = (msg, index) => {
    if (msg.type === 'quickReplies') {
      return (
        <div key={index} className="flex flex-col gap-2 mb-4">
          <div className="bg-gray-100 rounded-2xl rounded-bl-sm p-3 max-w-[85%] text-sm">
            {msg.text}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleQuickReply('📦 Meus pedidos')} 
                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200 hover:bg-purple-100 transition">
              📦 Meus pedidos
            </button>
            <button onClick={() => handleQuickReply('💳 Financeiro')} 
                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200 hover:bg-purple-100 transition">
              💳 Financeiro
            </button>
            <button onClick={() => handleQuickReply('🛠 Suporte técnico')} 
                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200 hover:bg-purple-100 transition">
              🛠 Suporte
            </button>
            <button onClick={() => handleQuickReply('📄 Abrir chamado')} 
                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200 hover:bg-purple-100 transition">
              📄 Abrir chamado
            </button>
            <button onClick={() => handleQuickReply('👤 Falar com atendente')} 
                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200 hover:bg-purple-100 transition">
              👤 Atendente
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === 'auth') {
      return (
        <div key={index} className="flex flex-col gap-3 mb-4">
          <div className="bg-gray-100 rounded-2xl rounded-bl-sm p-3 max-w-[85%] text-sm">
            {msg.text}
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => handleAuth('login')}
                    className="px-6 py-3 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-700 transition shadow-md">
              Entrar com minha conta
            </button>
            <button onClick={() => handleAuth('continue')}
                    className="px-6 py-3 bg-white text-purple-600 rounded-full text-sm font-medium border-2 border-purple-600 hover:bg-purple-50 transition">
              Continuar sem identificar
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === 'loginForm') {
      return (
        <div key={index} className="flex flex-col gap-3 mb-4">
          <div className="bg-gray-100 rounded-2xl rounded-bl-sm p-3 max-w-[85%] text-sm">
            {msg.text}
          </div>
          <div className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-gray-200">
            <input 
              type="email" 
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="E-mail" 
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
            />
            <input 
              type="password" 
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Senha" 
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" 
            />
            <button 
              onClick={handleLogin}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
              disabled={!loginEmail || !loginPassword}
            >
              Entrar
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === 'authenticatedOptions') {
      return (
        <div key={index} className="flex flex-col gap-2 mb-4">
          <div className="bg-gray-100 rounded-2xl rounded-bl-sm p-3 max-w-[85%] text-sm">
            {msg.text}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleQuickReply('🔍 Ver meus chamados')}
                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200 hover:bg-purple-100 transition">
              🔍 Ver meus chamados
            </button>
            <button onClick={() => handleQuickReply('📦 Meus pedidos')}
                    className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200 hover:bg-purple-100 transition">
              📦 Meus pedidos
            </button>
            <button onClick={handleEndChat}
                    className="px-4 py-2 bg-gray-50 text-gray-600 rounded-full text-xs font-medium border border-gray-200 hover:bg-gray-100 transition">
              Encerrar atendimento
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === 'ticketList') {
      return (
        <div key={index} className="flex flex-col gap-3 mb-4">
          <div className="bg-gray-100 rounded-2xl rounded-bl-sm p-3 max-w-[85%] text-sm">
            {msg.text}
          </div>
          {msg.data.map(ticket => (
            <div key={ticket.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h4 className="font-semibold text-sm mb-1">Chamado #{ticket.id}</h4>
              <p className="text-xs text-gray-600 mb-2">{ticket.title}</p>
              <p className={`text-xs font-medium mb-1 ${ticket.statusColor}`}>Status: {ticket.status}</p>
              <p className="text-xs text-gray-500 mb-3">Última atualização: {ticket.lastUpdate}</p>
              <button onClick={() => handleTicketDetails(ticket)}
                      className="px-4 py-1.5 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200 hover:bg-purple-100 transition">
                Ver detalhes
              </button>
            </div>
          ))}
        </div>
      );
    }

    if (msg.type === 'ticketDetails') {
      const ticket = msg.data;
      return (
        <div key={index} className="flex flex-col gap-3 mb-4">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4 shadow-sm">
            <h4 className="font-bold text-sm mb-2">Chamado #{ticket.id}</h4>
            <p className={`text-xs font-medium mb-2 ${ticket.statusColor}`}>
              Status: {ticket.status}
            </p>
            <div className="border-t border-purple-200 my-2"></div>
            <p className="text-xs text-gray-700 mb-2">
              <strong>Resumo:</strong> {ticket.description}
            </p>
            <div className="border-t border-purple-200 my-2"></div>
            <p className="text-xs text-green-600">
              <strong>Previsão:</strong> {ticket.deadline}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 bg-purple-50 text-purple-600 rounded-full text-xs font-medium border border-purple-200 hover:bg-purple-100 transition">
              ➕ Adicionar comentário
            </button>
            <button className="px-4 py-2 bg-red-50 text-red-600 rounded-full text-xs font-medium border border-red-200 hover:bg-red-100 transition">
              ✕ Encerrar chamado
            </button>
            <button onClick={handleShowTickets}
                    className="px-4 py-2 bg-gray-50 text-gray-600 rounded-full text-xs font-medium border border-gray-200 hover:bg-gray-100 transition">
              ← Voltar à lista
            </button>
          </div>
        </div>
      );
    }

    if (msg.type === 'queue') {
      return (
        <div key={index} className="flex flex-col gap-3 mb-4">
          <div className="bg-gray-100 rounded-2xl rounded-bl-sm p-3 max-w-[85%] text-sm">
            {msg.text}
          </div>
          {queuePosition > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-300 rounded-xl p-4 shadow-sm">
              <p className="text-sm text-center font-medium text-yellow-800 mb-2">⏳ Aguardando...</p>
              <p className="text-lg text-center font-bold text-yellow-900 mb-3">
                Você é o {queuePosition}º na fila
              </p>
              <div className="w-full bg-yellow-200 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full transition-all duration-500"
                     style={{width: `${((3 - queuePosition) / 3) * 100}%`}}></div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (msg.type === 'humanJoined') {
      return (
        <div key={index} className="flex justify-center mb-4">
          <div className="bg-green-100 border border-green-300 rounded-full px-4 py-2 text-xs text-green-800 font-medium shadow-sm">
            👤 Atendente Maria entrou na conversa
          </div>
        </div>
      );
    }

    if (msg.type === 'human') {
      return (
        <div key={index} className="flex gap-2 mb-4">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
            <User size={18} className="text-white" />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl rounded-bl-sm p-3 max-w-[75%] text-sm">
            <p className="font-semibold text-xs text-blue-900 mb-1">Maria (Atendente)</p>
            {msg.text}
          </div>
        </div>
      );
    }

    if (msg.type === 'csat') {
      return (
        <div key={index} className="flex flex-col gap-3 mb-4">
          <div className="bg-gray-100 rounded-2xl rounded-bl-sm p-3 max-w-[85%] text-sm">
            {msg.text}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-center font-medium text-gray-700 mb-3">
              Avalie de 1 a 5 estrelas:
            </p>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)}
                        className="transition-transform hover:scale-110">
                  <Star size={32} 
                        className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                        strokeWidth={1.5} />
                </button>
              ))}
            </div>
            <textarea placeholder="Conte o que podemos melhorar (opcional)..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 mb-3"
                      rows="3"></textarea>
            <button onClick={handleRatingSubmit}
                    disabled={rating === 0}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
              Enviar feedback
            </button>
          </div>
        </div>
      );
    }

    // Mensagem padrão
    return (
      <div key={index} className={`flex ${msg.isBot ? 'justify-start' : 'justify-end'} mb-4`}>
        <div className={`rounded-2xl p-3 max-w-[85%] text-sm shadow-sm ${
          msg.isBot 
            ? 'bg-gray-100 rounded-bl-sm' 
            : 'bg-purple-600 text-white rounded-br-sm'
        }`}>
          {msg.text}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-50 to-pink-50 p-8 flex items-center justify-center">
      <div className="relative">
        {/* Smartphone Frame */}
        <div className="relative w-[380px] h-[780px] bg-black rounded-[60px] shadow-2xl p-3">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-7 bg-black rounded-b-3xl z-20"></div>
          
          {/* Screen */}
          <div className="w-full h-full bg-white rounded-[48px] overflow-hidden relative">
            
            {/* Status Bar */}
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-white to-transparent z-10 flex items-center justify-between px-8 pt-2">
              <span className="text-xs font-semibold">9:41</span>
              <div className="flex gap-1 items-center">
                <div className="w-4 h-3 border border-black rounded-sm"></div>
                <div className="w-4 h-4 border-2 border-black rounded-full"></div>
                <div className="flex gap-0.5">
                  <div className="w-1 h-3 bg-black rounded-sm"></div>
                  <div className="w-1 h-3.5 bg-black rounded-sm"></div>
                  <div className="w-1 h-4 bg-black rounded-sm"></div>
                </div>
              </div>
            </div>

            {/* Home Screen */}
            {!chatOpen && (
              <div className="h-full flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 pt-16 pb-6 shadow-lg">
                  <div className="flex justify-between items-center mb-8">
                    <div className="text-white font-bold text-xl">Logo</div>
                    <div className="flex gap-4 text-white text-sm">
                      <button className="hover:underline">Produtos</button>
                      <button className="hover:underline">Suporte</button>
                    </div>
                  </div>
                </div>

                {/* Hero Section */}
                <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                  <div className="mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center mb-6 mx-auto shadow-xl animate-bounce">
                      <MessageCircle size={48} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-3">
                      Atendimento 24/7
                    </h1>
                    <p className="text-gray-600 mb-8">
                      Tire dúvidas, acompanhe pedidos e abra chamados sem esperar na fila
                    </p>
                    <button onClick={handleOpenChat}
                            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all">
                      Iniciar atendimento
                    </button>
                  </div>
                </div>

                {/* Floating Widget */}
                <div className="absolute bottom-8 right-8">
                  <div className="relative">
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
                      24/7
                    </div>
                    <button onClick={handleOpenChat}
                            className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform">
                      <MessageCircle size={32} className="text-white" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Window */}
            {chatOpen && (
              <div className="h-full flex flex-col">
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 pt-14 pb-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <span className="text-2xl">🤖</span>
                      </div>
                      <div>
                        <h3 className="text-white font-bold text-lg">Assistente Virtual</h3>
                        <p className="text-purple-100 text-xs">Online · resposta em segundos</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setChatOpen(false)}
                              className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition">
                        <Minus size={20} className="text-white" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto px-4 py-4 bg-gradient-to-b from-gray-50 to-white">
                  {messages.map((msg, index) => renderMessage(msg, index))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="border-t border-gray-200 p-4 bg-white">
                  <div className="flex items-center gap-2">
                    <button type="button" className="p-2 text-gray-400 hover:text-gray-600 transition">
                      <Paperclip size={20} />
                    </button>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button 
                      onClick={handleSendMessage}
                      className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-white hover:shadow-lg transition disabled:opacity-50"
                      disabled={!inputValue.trim()}>
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 font-medium">
            Protótipo Interativo de Alta Fidelidade
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Clique no botão para iniciar uma conversa com o chatbot
          </p>
        </div>
      </div>
    </div>
  );
}