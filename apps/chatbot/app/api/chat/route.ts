import { createXai } from '@ai-sdk/xai';
import { streamText } from 'ai';

export const runtime = 'edge';

export async function POST(req: Request) {
  if (!process.env.XAI_API_KEY) {
    return new Response('Server configuration error: Missing API key', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const origin = req.headers.get('origin') ?? '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean);
  const originHost = origin ? new URL(origin).host : '';
  if (originHost && !allowedOrigins.includes(originHost)) {
    console.log(`Unauthorized origin: ${originHost}`);
    return new Response('Unauthorized origin', {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // TODO: Implement rate limiting (e.g., Upstash Redis, in-memory cache for dev)
  // Example: Check headers from CDN/proxy
  // const remaining = req.headers.get('x-ratelimit-remaining');
  // if (remaining && parseInt(remaining) <= 0) {
  //   return new Response('Rate limit exceeded', { status: 429 });
  // }

  try {
    const body = await req.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Invalid or missing messages array', { status: 400 });
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'user' || typeof lastMsg.content !== 'string' || lastMsg.content.trim() === '') {
      return new Response('Invalid last user message', { status: 400 });
    }

    // Input sanitization: limit length to prevent abuse/token explosion
    if (lastMsg.content.length > 4000) {
      return new Response('Message too long (max 4000 chars)', { status: 400 });
    }

    // Optional: Sanitize content further (e.g., remove scripts, but SDK handles injection safety)

    const customerId = req.headers.get('x-customer-id') ?? 'default';

    // Model router heuristics
    const lowerContent = lastMsg.content.toLowerCase();
    const complexKeywords = ['explain', 'reason', 'calculate', 'analyze', 'solve', 'debug', 'why', 'how does', 'what is'];
    const hasComplexKeyword = complexKeywords.some(kw => lowerContent.includes(kw));
    const mathRegex = /[0-9+\-*/().=<>!%]+/;
    const codeRegex = /\b(function|def|class|import|const|let|var|if|for|while|try|catch)\b|```|^\s*[a-zA-Z]+\s*[({]/;
    const isComplex = lowerContent.length > 80 || hasComplexKeyword || mathRegex.test(lowerContent) || codeRegex.test(lowerContent);

    const modelId = isComplex ? 'grok-4-1' : 'grok-beta';
    console.log(`Selected model: ${modelId} for query length ${lowerContent.length} "${lowerContent.substring(0, 50)}..." (complex: ${isComplex}, customer: ${customerId})`);

    const xai = createXai({
      apiKey: process.env.XAI_API_KEY,
    });
    const model = xai(modelId);

    const systemPrompt = `You are a helpful support agent for website customer "${customerId}". Provide concise, accurate responses.`;

    const result = await streamText({
      model,
      messages,
      system: systemPrompt,
    });

    // Future: Dynamic per-customer config (e.g., model, key from DB/env map)
    // if (customerId !== 'default') { use custom key/model }

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(`Internal server error: ${error.message || error}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Health check endpoint
export async function GET() {
  return new Response(JSON.stringify({ status: 'Chat API ready', timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
