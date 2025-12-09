import ChatWidget from '../../components/ChatWidget';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ customerId?: string; theme?: string; embed?: string }> }) {
  const params = await searchParams;
  const customerId = params.customerId || 'demo';
  const theme = (params.theme || 'dark') as 'light' | 'dark';
  const isEmbed = params.embed === 'true';

  return (
    <main
      className="flex items-center justify-center bg-transparent"
      style={{
        height: '100vh',
        width: '100%',
        margin: 0,
        padding: isEmbed ? 0 : 16,
        background: isEmbed ? 'transparent' : '#000'
      }}
    >
      <ChatWidget
        customerId={customerId}
        api="/api/chat"
        theme={theme}
        isEmbed={isEmbed}
      />
    </main>
  );
}
