import { createXai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';

function getCookie(req: Request, cookieName: string): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookieStr) => {
    const trimmed = cookieStr.trim();
    if (!trimmed) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    // Basic handling for quoted values
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value; // fallback
    }
  });
  return cookies[cookieName] ?? null;
}

export const runtime = 'nodejs';

/**
 * Secure proxy to xAI Grok models for chat streaming.
 * - Origin validation against ALLOWED_ORIGINS env.
 * - Input validation: messages array, last user msg, length <=4000.
 * - Model routing: grok-4-1 for complex (long, keywords, math/code), grok-beta otherwise.
 * - Tenant support via x-customer-id header in prompt/ logs.
 * - Streaming SSE response, edge runtime for speed.
 * - Edge cases: unauthorized origin (403), invalid input (400), missing key (500), long msg (400).
 * - Verbose console logs for debugging: requests, model choice, errors with stack/context.
 * - Future: rate limiting, sanitization, per-customer config.
 * - Tests: Unit/Jest for logic, E2E/Playwright for full flow/status codes.
 * Env req: XAI_API_KEY (from console.x.ai), ALLOWED_ORIGINS (e.g. localhost:3000,example.com)
 */
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

  // Milestone 6: Declare tracing vars for catch access
  let trace: any = null;
  let tracePath: string | null = null;
  let startTime = 0;

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

    // Milestone 6: Tracing setup
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('chat-session-id')?.value;
    const sessionId = sessionCookie || `${Date.now()}-${Math.random().toString(36).substring(2)}`; // generate new if none

    const traceId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const tracesDir = path.join(process.cwd(), '../../data/traces');
    await fs.mkdir(tracesDir, { recursive: true }).catch(() => {
      // ignore if exists or error
    });
    tracePath = path.join(tracesDir, `${traceId}.json`);
    startTime = Date.now();
    trace = {
      id: traceId,
      sessionId,
      startTime: new Date().toISOString(),
      endTime: null,
      durationMs: null,
      originHost,
      customerId,
      modelId: null,
      decision: null,
      input: {
        messagesCount: messages.length,
        totalChars: messages.reduce((acc, msg) => acc + (typeof msg.content === 'string' ? msg.content.length : 0), 0),
        lastUserPreview: lastMsg.content.substring(0, 200) + (lastMsg.content.length > 200 ? ' [truncated for PII]' : ''),
      },
      output: null,
      finishReason: null,
      usage: null,
      totalUsage: null,
      steps: null,
      error: null,
    };

  // Verbose logging for debugging API calls
  console.log('[API Debug] Processing request:', {
    originHost,
    customerId,
    messageLength: lastMsg.content.length,
    allowedOrigins: allowedOrigins.length,
  });

    // Session state & full history analysis for dynamic model routing/escalation
    const sessionCookieName = 'chat_session';

    interface SessionData {
      model: 'grok-beta' | 'grok-4-1';
      sessionId: string;
    }

    let sessionData: SessionData = { model: 'grok-beta', sessionId: crypto.randomUUID() };
    const cookieValue = getCookie(req, sessionCookieName);
    if (cookieValue) {
      try {
        const parsed = JSON.parse(cookieValue) as Partial<SessionData>;
        sessionData = {
          model: (parsed.model as 'grok-beta' | 'grok-4-1' ?? 'grok-beta'),
          sessionId: parsed.sessionId ?? crypto.randomUUID()
        };
      } catch (e) {
        console.warn(`[Session] Invalid cookie for ${sessionCookieName}, generating new session ${sessionData.sessionId.slice(0, 8)}`);
      }
    }
    const previousModel = sessionData.model;

    // Analyze context/history (keywords/length/tools)
    const complexKeywords = ['explain', 'reason', 'calculate', 'analyze', 'solve', 'debug', 'why', 'how does', 'what is', 'step by step', 'compare', 'optimize'];
    const mathRegex = /[0-9+\-*/().=<>!%]+/;
    const codeRegex = /\b(function|def|class|import|const|let|var|if|for|while|try|catch|async|await|return)\b|```|\.(js|py|java|cpp|go|rs)/;
    let totalUserLength = 0;
    let hasComplexKeywordOrCodeInHistory = false;
    let hasToolCallsInHistory = false;
    let numUserMessages = 0;

    for (const msg of messages) {
      if (msg.role === 'user') {
        numUserMessages++;
        const content = typeof msg.content === 'string' ? msg.content.toLowerCase() : '';
        totalUserLength += content.length;
        if (complexKeywords.some(kw => content.includes(kw)) ||
            mathRegex.test(content) ||
            codeRegex.test(content)) {
          hasComplexKeywordOrCodeInHistory = true;
        }
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          hasToolCallsInHistory = true;
        }
        if ('function_call' in msg && msg.function_call) {
          hasToolCallsInHistory = true;
        }
      }
    }

    const avgMsgLength = numUserMessages > 0 ? totalUserLength / numUserMessages : 0;
    const needsHeavyModel = totalUserLength > 1000 ||
                            numUserMessages > 5 ||
                            hasComplexKeywordOrCodeInHistory ||
                            hasToolCallsInHistory ||
                            avgMsgLength > 150;

    const decidedModel = (needsHeavyModel || previousModel === 'grok-4-1') ? 'grok-4-1' : 'grok-beta';
    const modelId = decidedModel;

    const switchOccurred = decidedModel !== previousModel;
    if (switchOccurred) {
      console.log(`[Model Escalation] Session ${sessionData.sessionId.slice(0,8)}... : ${previousModel} → ${modelId} | Triggers: len=${totalUserLength}, msgs=${numUserMessages}, complex=${hasComplexKeywordOrCodeInHistory}, tools=${hasToolCallsInHistory}, avg=${avgMsgLength.toFixed(0)}`);
    }

    // Updated verbose logging with model info
    console.log('[API Debug] Request:', {
      originHost,
      customerId,
      sessionId: sessionData.sessionId.slice(0,8) + '...',
      previousModel,
      modelId,
      switchOccurred,
      needsHeavyModel,
      numUserMessages,
      totalUserLength,
      hasToolCallsInHistory,
      allowedOrigins: allowedOrigins.length,
    });

    // Update trace with model decision
    trace.modelId = modelId;
    trace.decision = {
      isComplex,
      queryLength: lowerContent.length,
      hasComplexKeyword,
      hasMath: mathRegex.test(lowerContent),
      hasCode: codeRegex.test(lowerContent),
    };

    const xai = createXai({
      apiKey: process.env.XAI_API_KEY,
    });
    const model = xai(modelId);

    const systemPrompt = `You are a helpful support agent for website customer "${customerId}". Provide concise, accurate responses.`;

    const result = await streamText({
      model,
      messages,
      system: systemPrompt,
      onFinish: async (event) => {
        trace.endTime = new Date().toISOString();
        trace.durationMs = Date.now() - startTime;
        trace.output = event.text;
        trace.finishReason = event.finishReason;
        trace.usage = 'usage' in event ? event.usage : null; // type guard if needed
        trace.totalUsage = event.totalUsage;
        trace.steps = event.steps.map((step: any, index: number) => ({
          stepIndex: index,
          textLength: step.text?.length || 0,
          toolCallsCount: step.toolCalls?.length || 0,
          finishReason: step.finishReason,
          usage: step.usage,
        }));
        await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
        console.log(`[Trace] Saved trace ${traceId} at ${tracePath}, duration: ${trace.durationMs}ms, total tokens: ${trace.totalUsage?.total || 0}`);
      },
      onError: async ({ error }) => {
        trace.error = error instanceof Error ? error.message : String(error);
        trace.endTime = new Date().toISOString();
        trace.durationMs = Date.now() - startTime;
        await fs.writeFile(tracePath, JSON.stringify(trace, null, 2)).catch((writeErr) => console.error('[Trace] Failed to save error trace:', writeErr));
        console.error(`[Trace] Error trace saved for ${traceId}:`, trace.error);
      },
    });

    // Future: Dynamic per-customer config (e.g., model, key from DB/env map)
    // if (customerId !== 'default') { use custom key/model }

    return result.toTextStreamResponse();
  } catch (error: any) {
    // Verbose error logging for debugging
    console.error('[API Debug] Full error details:', {
      error: error.message,
      stack: error.stack,
      originHost,
      customerId,
      userMessage: lastMsg?.content?.substring(0, 100) + '...',
    });
    console.error('Raw error object:', error);

    // Milestone 6: Save trace on error
    if (trace && tracePath) {
      trace.error = error.message || String(error);
      trace.endTime = new Date().toISOString();
      trace.durationMs = Date.now() - startTime;
      await fs.writeFile(tracePath, JSON.stringify(trace, null, 2)).catch(writeErr => {
        console.error('[Trace] Failed to save catch error trace:', writeErr);
      });
    }

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
