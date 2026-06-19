import ChatbotPrototype from './chatbot_highfi_interactive';
import AdminDashboard from './features/mitsue-assistant/AdminDashboard';

function App() {
  if (window.location.pathname.startsWith('/admin')) {
    return <AdminDashboard />;
  }

  return <ChatbotPrototype />;
}

export default App;
