import ChatWidget from '../../components/ChatWidget';

export default function ChatPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <ChatWidget 
          customerId="demo" 
          api="/api/chat" 
          theme="light" 
        />
      </div>
    </main>
  );
}
