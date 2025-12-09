import ChatWidget from '../../components/ChatWidget';

import Script from 'next/script';

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ customerId?: string; theme?: string }> }) {
  const params = await searchParams;
  const customerId = params.customerId || 'demo';
  const theme = (params.theme || 'light') as 'light' | 'dark';

  return (
    <>
      <main className="flex min-h-screen flex-col items-center justify-center p-4" style={{ height: '100vh', margin: 0 }}>
        <div className="w-full max-w-2xl h-full">
          <ChatWidget 
            customerId={customerId} 
            api="/api/chat" 
            theme={theme} 
          />
        </div>
      </main>
      <Script src="https://cdn.jsdelivr.net/npm/iframe-resizer@4.3.2/js/iframeResizer.contentWindow.min.js" strategy="afterInteractive" />
    </>
  );
}

