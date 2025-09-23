import { NextRequest, NextResponse } from 'next/server';
import botInstructions from '@/data/botInstructions.json';

import {
  ensureRateLimit,
  isCircuitOpen,
  registerFailure,
  registerSuccess,
} from '@/lib/chatGuards';
import { logEvent } from '@/lib/logger';

const systemPrompt = botInstructions.prompt.join('\n');

type ChatRole = 'system' | 'user' | 'assistant';
type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatRequestBody = {
  messages: ChatMessage[];
};

type OpenRouterChoice = {
  message?: {
    content?: string;
  };
};

type OpenRouterErrorPayload = {
  error: string | { message?: string };
};

const allowedRoles: ChatRole[] = ['user', 'assistant'];
const MAX_MESSAGES = Number(process.env.MAX_CONTEXT_MESSAGES ?? 20);
const MAX_CONTENT_LENGTH = Number(process.env.MAX_MESSAGE_CHARS ?? 2000);

const isChatMessage = (value: unknown): value is ChatMessage => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ChatMessage>;

  if (
    typeof candidate.content !== 'string' ||
    candidate.content.trim().length === 0 ||
    candidate.content.length > MAX_CONTENT_LENGTH
  ) {
    return false;
  }

  return (
    typeof candidate.role === 'string' &&
    allowedRoles.includes(candidate.role as ChatRole) &&
    true
  );
};

const isChatRequestBody = (value: unknown): value is ChatRequestBody => {
  if (!value || typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ChatRequestBody>;

  if (!Array.isArray(candidate.messages) || candidate.messages.length === 0) {
    return false;
  }

  if (candidate.messages.length > MAX_MESSAGES) {
    return false;
  }

  return candidate.messages.every(isChatMessage);
};

const reportRejectedPayload = (reason: string, payload: unknown) => {
  logEvent('chat_payload_rejected', {
    level: 'warn',
    payload: {
      reason,
      size: Array.isArray((payload as { messages?: unknown[] })?.messages)
        ? (payload as { messages?: unknown[] }).messages!.length
        : undefined,
    },
  });
};

const hasError = (payload: unknown): payload is OpenRouterErrorPayload => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  return 'error' in payload && (payload as { error: unknown }).error != null;
};

const extractReply = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const choices = (payload as { choices?: OpenRouterChoice[] }).choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const content = choices[0]?.message?.content;
  return typeof content === 'string' && content.trim().length > 0 ? content : null;
};

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();

    if (!isChatRequestBody(body)) {
      reportRejectedPayload('mensagens inválidas', body);
      return NextResponse.json(
        { error: 'Payload inválido. Envie um array messages com role e content.' },
        { status: 400 }
      );
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIdentifier = forwardedFor?.split(',')[0]?.trim() ?? 'unknown';

    const rateLimitResult = await ensureRateLimit(clientIdentifier);

    if (!rateLimitResult.allowed) {
      reportRejectedPayload('limite de requisições excedido', body);
      return NextResponse.json(
        {
          error: 'Muitas solicitações. Tente novamente em instantes.',
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        { status: 429 }
      );
    }

    if (await isCircuitOpen()) {
      logEvent('chat_circuit_open', { level: 'warn' });
      return NextResponse.json(
        { error: 'Serviço temporariamente indisponível.' },
        { status: 503 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      logEvent('chat_missing_api_key', { level: 'error' });
      return NextResponse.json(
        { error: 'Serviço temporariamente indisponível.' },
        { status: 503 }
      );
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://lumamart-chatbot.vercel.app/',
        'X-Title': 'lumamart-chatbot',
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...body.messages,
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      logEvent('chat_openrouter_error', {
        level: 'error',
        payload: {
          status: response.status,
          body: errorDetails,
        },
      });
      await registerFailure(`status ${response.status}`);
      return NextResponse.json(
        { error: 'Não foi possível gerar uma resposta agora.' },
        { status: 502 }
      );
    }

    const data: unknown = await response.json();

    if (hasError(data)) {
      logEvent('chat_openrouter_payload_error', {
        level: 'error',
        payload: { error: (data as OpenRouterErrorPayload).error },
      });
      await registerFailure('payload.error');
      return NextResponse.json(
        { error: 'Não foi possível gerar uma resposta agora.' },
        { status: 502 }
      );
    }

    const reply = extractReply(data);

    if (!reply) {
      logEvent('chat_openrouter_unexpected_payload', {
        level: 'error',
        payload: { data },
      });
      await registerFailure('payload.sem_conteudo');
      return NextResponse.json(
        { error: 'Não foi possível gerar uma resposta agora.' },
        { status: 502 }
      );
    }

    await registerSuccess();
    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof SyntaxError) {
      reportRejectedPayload('json inválido', null);
      return NextResponse.json(
        { error: 'JSON inválido na requisição.' },
        { status: 400 }
      );
    }

    logEvent('chat_route_unexpected_error', {
      level: 'error',
      payload: { message: (error as Error).message },
    });
    await registerFailure('exceção_genérica');
    return NextResponse.json(
      { error: 'Opa! Tivemos uma pausa na nossa conexão. Tente mandar sua pergunta de novo! 🙂' },
      { status: 500 }
    );
  }
}
