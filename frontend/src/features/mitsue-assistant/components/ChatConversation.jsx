import { Paperclip, Send } from 'lucide-react';
import MessageBubble from './MessageBubble';

export default function ChatConversation({
  messages,
  isTyping,
  endRef,
  onProtocolClick,
  inputValue,
  onInputChange,
  onSubmit,
  onAttach,
  onMessageAction,
  visitorName,
  placeholder = 'Digite sua duvida ou conte o que aconteceu...',
  disabled = false,
  headerSlot = null,
  children = null,
}) {
  function handleSubmit(event) {
    event.preventDefault();
    onSubmit?.();
  }

  return (
    <section className="chat-conversation">
      <div className="chat-message-scroll">
        {headerSlot}

        <div className="phone-thread chat-thread">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              visitorName={visitorName}
              onProtocolClick={onProtocolClick}
              onAction={onMessageAction}
            />
          ))}
          {isTyping ? (
            <div className="message-row message-row-assistant">
              <div className="message-avatar message-avatar-bot">AT</div>
              <div className="message-shell message-shell-assistant typing-bubble">
                <span />
                <span />
                <span />
              </div>
            </div>
          ) : null}
        </div>

        {children}
        <div ref={endRef} />
      </div>

      <form className="phone-composer chat-fixed-composer" onSubmit={handleSubmit}>
        <textarea
          rows="2"
          value={inputValue}
          placeholder={placeholder}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <button className="compose-attach" type="button" onClick={onAttach} aria-label="Anexar documento">
          <Paperclip size={15} />
        </button>
        <button className="compose-send" type="submit" disabled={disabled} aria-label="Enviar mensagem">
          <Send size={15} />
        </button>
      </form>
    </section>
  );
}
