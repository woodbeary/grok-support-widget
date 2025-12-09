import { createXai } from '@ai-sdk/xai';
import { streamText, convertToModelMessages } from 'ai';
import { tool } from 'ai'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers';


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

export const runtime = 'nodejs'; // Switched for M6 tracing & M8 ticket FS ops; note: higher latency than edge but necessary for local storage

/**
 * Secure proxy to xAI Grok models for chat streaming.
 * - Origin validation against ALLOWED_ORIGINS env.
 * - Input validation: messages array, last user msg, length <=4000.
 * - Advanced Model Routing & Dynamic Upgrades (Milestone 5): Start with low-latency grok-4-1-fast-non-reasoning; analyze full context/history → escalate to grok-4-1-fast-reasoning mid-chat. Session state via 'chat_session' cookie.
 * - Logs: Console traces for model switches ([Model Escalation]), latency ([Performance]), debug ([API Debug]).
 * - Tenant support via x-customer-id header in prompt/ logs.
 * - Streaming SSE response, edge runtime for speed.
 * - Edge cases: unauthorized origin (403), invalid input (400), missing key (500), long msg (400).
 * - Verbose console logs for debugging: requests, model choice/escalation, errors with stack/context, performance.
 * - Future: rate limiting, sanitization, per-customer config, full tracing/DB (Milestone 6).
 * - Tests: Unit/Jest for logic/escalation heuristics, E2E/Playwright for multi-turn flows/status codes/curl checks.
 * Env req: XAI_API_KEY (from console.x.ai), ALLOWED_ORIGINS (e.g. localhost:3000,example.com). For prod: NODE_ENV=production for Secure cookie.
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
  const customerId = req.headers.get('x-customer-id') ?? 'default';
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


  // Variables declared outside try for access in catch block (tracing)
  let trace: any = null;
  let tracePath: string = '';
  let startTime: number = 0;
  let lastMsg: any = null;

  try {
    const body = await req.json();
    let { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Invalid or missing messages array', { status: 400 });
    }

    // Extract message content - handle BOTH AI SDK v5 format (parts) AND legacy format (content)
    const getMessageContent = (msg: any): string => {
      // AI SDK v5 format: message has 'parts' array with text parts
      if (msg.parts && Array.isArray(msg.parts)) {
        const textParts = msg.parts.filter((p: any) => p.type === 'text');
        return textParts.map((p: any) => p.text).join('');
      }
      // Legacy format: message has 'content' string
      if (typeof msg.content === 'string') {
        return msg.content;
      }
      return '';
    };

    // Normalize messages to UI format (with parts) for convertToModelMessages
    const normalizeMessages = (msgs: any[]): any[] => {
      return msgs.map((msg: any) => {
        // Already in parts format
        if (msg.parts && Array.isArray(msg.parts)) {
          return msg;
        }
        // Convert legacy content string to parts format
        if (typeof msg.content === 'string') {
          return {
            ...msg,
            parts: [{ type: 'text', text: msg.content }],
          };
        }
        return msg;
      });
    };

    // Normalize messages for processing
    messages = normalizeMessages(messages);

    const lastMsg = messages[messages.length - 1];
    const lastMsgContent = getMessageContent(lastMsg);

    if (lastMsg.role !== 'user' || lastMsgContent.trim() === '') {
      return new Response('Invalid last user message', { status: 400 });
    }

    // Input sanitization: limit length to prevent abuse/token explosion
    if (lastMsgContent.length > 4000) {
      return new Response('Message too long (max 4000 chars)', { status: 400 });
    }

    // Optional: Sanitize content further (e.g., remove scripts, but SDK handles injection safety)


    // Milestone 6: Tracing setup
    const cookieStore = await cookies();
    const sessionCookie = (await cookieStore.get('chat-session-id'))?.value;
    const sessionId = sessionCookie || `${Date.now()}-${Math.random().toString(36).substring(2)}`; // generate new if none

    // Fix: Store traces in local app data directory so Admin API can find them
    const tracesDir = path.join(process.cwd(), 'data', 'traces');
    await fs.mkdir(tracesDir, { recursive: true }).catch(() => {
      // ignore if exists or error
    });
    // Fix: Use sessionId for filename to prevent duplicate files for the same session
    // This allows appending/updating the same file as the conversation progresses
    tracePath = path.join(tracesDir, `${sessionId}.json`);

    // Load existing trace if available to preserve history
    trace = {
      id: sessionId,
      sessionId,
      userId: customerId,
      timestamp: new Date().toISOString(),
      model: null, // Will be set later
      messages: [], // Will be populated from current request context or just last message
      steps: []
    };

    try {
      const existingContent = await fs.readFile(tracePath, 'utf-8');
      const existingTrace = JSON.parse(existingContent);
      // Merge or keep existing useful data
      trace = { ...existingTrace, ...trace };
    } catch (e) {
      // New trace
    }
    startTime = Date.now();
    trace = {
      id: sessionId,
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
        totalChars: messages.reduce((acc: number, msg: any) => acc + getMessageContent(msg).length, 0),
        lastUserPreview: lastMsgContent.substring(0, 200) + (lastMsgContent.length > 200 ? ' [truncated for PII]' : ''),
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
      messageLength: lastMsgContent.length,
      allowedOrigins: allowedOrigins.length,
    });

    // Session state & full history analysis for dynamic model routing/escalation
    const sessionCookieName = 'chat_session';

    interface SessionData {
      model: 'grok-4-1-fast-non-reasoning' | 'grok-4-1-fast-reasoning';
      sessionId: string;
    }

    let sessionData: SessionData = { model: 'grok-4-1-fast-non-reasoning', sessionId: crypto.randomUUID() };
    const cookieValue = getCookie(req, sessionCookieName);
    if (cookieValue) {
      try {
        const parsed = JSON.parse(cookieValue) as Partial<SessionData>;
        if (parsed && parsed.sessionId) {
          sessionData = {
            sessionId: parsed.sessionId,
            model: (parsed.model as 'grok-4-1-fast-non-reasoning' | 'grok-4-1-fast-reasoning') ?? 'grok-4-1-fast-non-reasoning',
          };
        } else {
          sessionData.sessionId = parsed.sessionId ?? crypto.randomUUID();
        }
      } catch {
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
        const content = getMessageContent(msg).toLowerCase();
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

    const decidedModel = (needsHeavyModel || previousModel === 'grok-4-1-fast-reasoning') ? 'grok-4-1-fast-reasoning' : 'grok-4-1-fast-non-reasoning';
    const modelId = decidedModel;

    const switchOccurred = decidedModel !== previousModel;
    if (switchOccurred) {
      console.log(`[Model Escalation] Session ${sessionData.sessionId.slice(0, 8)}... : ${previousModel} → ${modelId} | Triggers: len=${totalUserLength}, msgs=${numUserMessages}, complex=${hasComplexKeywordOrCodeInHistory}, tools=${hasToolCallsInHistory}, avg=${avgMsgLength.toFixed(0)}`);
    }

    // Updated verbose logging with model info
    console.log('[API Debug] Request:', {
      originHost,
      customerId,
      sessionId: sessionData.sessionId.slice(0, 8) + '...',
      previousModel,
      modelId,
      switchOccurred,
      needsHeavyModel,
      numUserMessages,
      totalUserLength,
      hasToolCallsInHistory,
      allowedOrigins: allowedOrigins.length,
    });



    const xai = createXai({
      apiKey: process.env.XAI_API_KEY,
    });
    const model = xai(modelId);

    const createTicketTool = tool({
      description: 'Creates a support ticket for the customer. Use this when the user has an issue that needs tracking or escalation beyond this chat.',
      inputSchema: z.object({
        title: z.string().describe('Short title summarizing the issue'),
        description: z.string().describe('Full description including user details and context'),
      }),
      execute: async ({ title, description }: { title: string; description: string }) => {
        try {
          const ticketsDir = path.join(process.cwd(), 'data', 'tickets');
          await fs.mkdir(ticketsDir, { recursive: true });
          const id = randomUUID();
          const ticketData = {
            id,
            title,
            description,
            customerId,
            createdAt: new Date().toISOString(),
            status: 'open',
          };
          const filePath = path.join(ticketsDir, `${id}.json`);
          await fs.writeFile(filePath, JSON.stringify(ticketData, null, 2));
          console.log(`Ticket ${id} created for customer ${customerId}`);
          return `Support ticket "${title}" has been created with ID ${id}. Our team will review it shortly and contact you if needed.`;
        } catch (error) {
          console.error('Failed to create ticket:', error);
          return 'I tried to create a ticket but encountered an error. Please provide more details or contact support directly.';
        }
      },
    });

    const systemPrompt = `You are Grok, a helpful support agent powered by xAI for customer "${customerId}". 

You have access to tools to perform actions like creating support tickets.

Use the createTicket tool whenever appropriate:
- When the user reports a problem, bug, complaint, or requests assistance that requires follow-up.
- Extract title and description from the user's input and conversation context.
- Title should be concise and descriptive.
- Description should be detailed.

Be proactive in offering to create tickets for issues.
After creating a ticket, inform the user about the ID and next steps.

Provide empathetic, concise, and accurate responses.`;

    const result = await streamText({
      tools: {
        createTicket: createTicketTool,
      },
      model,
      // Convert UI messages (with parts) to model messages (with content) for streamText
      messages: convertToModelMessages(messages),
      system: systemPrompt,
      onFinish: async (event) => {
        if (!trace || !tracePath) return;
        try {
          const { text, usage, finishReason } = event;
          trace.output = text;
          trace.finishReason = finishReason;
          trace.usage = usage;
          trace.totalUsage = usage.totalTokens;
          trace.endTime = new Date().toISOString();
          trace.durationMs = Date.now() - startTime;
          trace.durationMs = Date.now() - startTime;
          // Capture steps to detect tool calls (tickets)
          trace.steps = event.steps;

          await fs.writeFile(tracePath, JSON.stringify(trace, null, 2));
          console.log(`[Trace] Saved trace ${trace.id}`);
        } catch (err) {
          console.error('[Trace] Failed to save trace:', err);
        }
      },
      onError: async (error) => {
        // Handled by outer try/catch for the trace update, but can log here too
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (trace && tracePath) {
          trace.error = errorMsg;
          trace.endTime = new Date().toISOString();
          trace.durationMs = Date.now() - startTime;
          await fs.writeFile(tracePath, JSON.stringify(trace, null, 2)).catch(console.error);
        }
      }
    });

    // Future: Dynamic per-customer config (e.g., model, key from DB/env map)
    // if (customerId !== 'default') { use custom key/model }

    // Use toUIMessageStreamResponse() for compatibility with useChat hook streaming (AI SDK v5)
    const response = result.toUIMessageStreamResponse();
    // Fix: Set session cookie if not present to persist session across messages
    if (!sessionCookie) {
      response.headers.set('Set-Cookie', `chat-session-id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    }
    return response;
  } catch (error: unknown) {
    // Verbose error logging for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('[API Debug] Full error details:', {
      error: errorMessage,
      stack: errorStack,
      originHost,
      customerId,
      userMessage: lastMsg?.content?.substring(0, 100) + '...',
    });
    console.error('Raw error object:', error);

    // Milestone 6: Save trace on error
    if (trace && tracePath) {
      trace.error = errorMessage;
      trace.endTime = new Date().toISOString();
      trace.durationMs = Date.now() - startTime;
      await fs.writeFile(tracePath, JSON.stringify(trace, null, 2)).catch(writeErr => {
        console.error('[Trace] Failed to save catch error trace:', writeErr);
      });
    }

    return new Response(`Internal server error: ${errorMessage}`, {
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
