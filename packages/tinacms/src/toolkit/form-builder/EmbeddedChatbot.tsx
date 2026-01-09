import React from 'react';
import { BiSend } from 'react-icons/bi';
import {
  AssistantRuntimeProvider,
  AssistantIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from '@assistant-ui/react';
import { cn } from '../../utils/cn';

export type EmbeddedChatbotContext = {
  id: string;
  label: string;
  description?: string;
  value?: unknown;
};

type EmbeddedChatbotProps = {
  contexts?: EmbeddedChatbotContext[];
};

const OPENROUTER_KEY_STORAGE = 'tinacms.openrouterKey';
const OPENROUTER_MODEL_STORAGE = 'tinacms.openrouterModel';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const MAX_CONTEXT_CHARS = 2000;

const formatContextValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildSystemPrompt = (
  context: EmbeddedChatbotContext | undefined,
  preview: string
) => {
  const base = 'You are a helpful TinaCMS editing assistant.';
  if (!context) return base;
  const clipped = preview
    ? preview.slice(0, MAX_CONTEXT_CHARS)
    : 'No content available.';
  return [
    base,
    `Context source: ${context.label}.`,
    context.description ? `Description: ${context.description}` : '',
    `Content:\n${clipped}`,
  ]
    .filter(Boolean)
    .join('\n');
};

const toOpenRouterMessages = (
  messages: readonly ThreadMessage[],
  systemPrompt: string
) => {
  const mapped = messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => {
      const content = message.content
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('')
        .trim();
      return { role: message.role, content };
    })
    .filter((message) => message.content.length > 0);

  if (systemPrompt) {
    return [{ role: 'system', content: systemPrompt }, ...mapped];
  }

  return mapped;
};

const UserMessage = () => (
  <MessagePrimitive.Root className='flex justify-end'>
    <div className='max-w-[85%] rounded-lg bg-foreground px-3 py-2 text-sm text-background'>
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

const AssistantMessage = () => (
  <MessagePrimitive.Root className='flex justify-start'>
    <div className='max-w-[85%] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground'>
      <MessagePrimitive.Parts />
    </div>
  </MessagePrimitive.Root>
);

export const EmbeddedChatbot = ({ contexts = [] }: EmbeddedChatbotProps) => {
  const [selectedId, setSelectedId] = React.useState<string | undefined>(
    contexts[0]?.id
  );

  React.useEffect(() => {
    if (!contexts.length) return;
    if (!selectedId || !contexts.some((item) => item.id === selectedId)) {
      setSelectedId(contexts[0].id);
    }
  }, [contexts, selectedId]);

  const selectedContext = contexts.find((item) => item.id === selectedId);
  const preview = formatContextValue(selectedContext?.value);
  const systemPrompt = React.useMemo(
    () => buildSystemPrompt(selectedContext, preview),
    [selectedContext, preview]
  );

  const [apiKey, setApiKey] = React.useState<string | undefined>(undefined);
  const [model, setModel] = React.useState<string>(DEFAULT_MODEL);
  const apiKeyRef = React.useRef<string | undefined>(undefined);
  const systemPromptRef = React.useRef(systemPrompt);
  const modelRef = React.useRef<string>(DEFAULT_MODEL);

  React.useEffect(() => {
    systemPromptRef.current = systemPrompt;
  }, [systemPrompt]);

  React.useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  React.useEffect(() => {
    modelRef.current = model;
  }, [model]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored =
      window.__TINACMS_OPENROUTER_API_KEY ||
      window.localStorage.getItem(OPENROUTER_KEY_STORAGE) ||
      undefined;
    setApiKey(stored || undefined);
    const storedModel =
      window.__TINACMS_OPENROUTER_MODEL ||
      window.localStorage.getItem(OPENROUTER_MODEL_STORAGE) ||
      DEFAULT_MODEL;
    setModel(storedModel || DEFAULT_MODEL);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail === 'string') {
        setApiKey(detail);
      } else if (!detail) {
        setApiKey(undefined);
      }
    };
    window.addEventListener('tinacms-openrouter-key', handler);
    const modelHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail === 'string') {
        setModel(detail);
      }
    };
    window.addEventListener('tinacms-openrouter-model', modelHandler);
    return () => {
      window.removeEventListener('tinacms-openrouter-key', handler);
      window.removeEventListener('tinacms-openrouter-model', modelHandler);
    };
  }, []);

  const adapter = React.useMemo<ChatModelAdapter>(() => {
    return {
      async run({ messages, abortSignal }) {
        const key = apiKeyRef.current;
        if (!key) {
          throw new Error('Missing OpenRouter API key.');
        }

        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            'HTTP-Referer':
              typeof window !== 'undefined'
                ? window.location.origin
                : 'http://localhost',
            'X-Title': 'TinaCMS',
          },
          body: JSON.stringify({
            model: modelRef.current || DEFAULT_MODEL,
            messages: toOpenRouterMessages(
              messages,
              systemPromptRef.current
            ),
            temperature: 0.3,
          }),
          signal: abortSignal,
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            data?.error?.message || `OpenRouter error (${response.status})`;
          throw new Error(message);
        }

        const text = data?.choices?.[0]?.message?.content ?? '';
        return { content: [{ type: 'text', text }] };
      },
    };
  }, []);

  const runtime = useLocalRuntime(adapter);
  const canSend = Boolean(apiKey);

  return (
    <div
      className={cn(
        'w-[320px] rounded-xl border border-border bg-background text-foreground shadow-sm',
        'overflow-hidden'
      )}
    >
      <div className='flex items-center justify-between border-b border-border px-4 py-3'>
        <div>
          <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground'>
            CG-CMS
          </p>
          <p className='text-sm font-medium text-foreground'>AI Assistant</p>
        </div>
        <span className='text-[11px] text-muted-foreground'>Beta</span>
      </div>
      {contexts.length ? (
        <div className='px-4 pt-3'>
          <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground'>
            Context
          </p>
          <div className='mt-2 flex flex-wrap gap-2'>
            {contexts.map((item) => {
              const isActive = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type='button'
                  onClick={() => setSelectedId(item.id)}
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    isActive
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className='px-4 py-3'>
        <div className='rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground'>
          {selectedContext ? (
            <>
              <p className='text-xs font-semibold text-foreground'>
                {selectedContext.label}
              </p>
              {selectedContext.description ? (
                <p className='mt-1 text-xs text-muted-foreground'>
                  {selectedContext.description}
                </p>
              ) : null}
              <div className='mt-2 max-h-[72px] overflow-hidden text-xs text-foreground/80'>
                {preview || 'No content available.'}
              </div>
            </>
          ) : (
            <span>No context selected.</span>
          )}
        </div>
        <AssistantRuntimeProvider runtime={runtime}>
          <ThreadPrimitive.Root className='mt-3 flex h-[240px] flex-col'>
            <ThreadPrimitive.Viewport className='flex-1 space-y-3 overflow-y-auto pr-1'>
              <AssistantIf condition={({ thread }) => thread.isEmpty}>
                <div className='text-xs text-muted-foreground'>
                  Ask about the selected context to get editing help.
                </div>
              </AssistantIf>
              <ThreadPrimitive.Messages
                components={{
                  UserMessage,
                  AssistantMessage,
                }}
              />
            </ThreadPrimitive.Viewport>
            <ComposerPrimitive.Root className='mt-2 flex items-center gap-2'>
              <ComposerPrimitive.Input
                placeholder='Ask AI...'
                disabled={!canSend}
                className={cn(
                  'min-h-[36px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  !canSend && 'opacity-60'
                )}
              />
              <ComposerPrimitive.Send
                disabled={!canSend}
                className='inline-flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50'
                aria-label='Send message'
                title={
                  canSend
                    ? 'Send'
                    : 'Add an OpenRouter API key in AI Settings to enable.'
                }
              >
                <BiSend className='h-4 w-4' />
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>
            {!canSend ? (
              <p className='mt-2 text-[11px] text-muted-foreground'>
                Add an OpenRouter API key in AI Settings to enable chat.
              </p>
            ) : null}
          </ThreadPrimitive.Root>
        </AssistantRuntimeProvider>
      </div>
    </div>
  );
};
