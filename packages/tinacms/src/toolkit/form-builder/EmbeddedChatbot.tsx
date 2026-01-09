
import React from 'react';
import { BiSend } from 'react-icons/bi';
import { Button } from '@toolkit/components/ui/button';
import { Input } from '@toolkit/components/ui/input';
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
    const [apiKey, setApiKey] = React.useState<string | undefined>(undefined);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored =
            window.__TINACMS_OPENROUTER_API_KEY ||
            window.localStorage.getItem(OPENROUTER_KEY_STORAGE) ||
            undefined;
        setApiKey(stored || undefined);

        const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (typeof detail === 'string') {
                setApiKey(detail);
            } else if (!detail) {
                setApiKey(undefined);
            }
        };
        window.addEventListener('tinacms-openrouter-key', handler);
        return () => window.removeEventListener('tinacms-openrouter-key', handler);
    }, []);

    const canSend = Boolean(apiKey);

    return (
        <div
            className={cn(
                'w-[320px] rounded-b-xl rounded-tl-none rounded-tr-xl border border-border bg-background text-foreground shadow-sm',
                'overflow-hidden'
            )}
        >
            <div className='flex items-center justify-between border-b border-border px-4 py-3'>
                <div>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground'>
                        CG-CMS
                    </p>
                    <p className='text-sm font-medium text-foreground'>
                        AI Assistant
                    </p>
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
                <div className='mt-3 flex items-center gap-2'>
                    <Input
                        type='text'
                        placeholder='Ask AI...'
                        className='h-9 text-sm'
                    />
                    <Button
                        type='button'
                        className='h-9 w-9 shrink-0 bg-foreground text-background hover:bg-foreground/90'
                        aria-label='Send message'
                        disabled={!canSend}
                        title={
                            canSend
                                ? 'Send'
                                : 'Add an OpenRouter API key in AI Settings to enable.'
                        }
                    >
                        <BiSend className='h-4 w-4' />
                    </Button>
                </div>
            </div>
        </div>
    );
};
