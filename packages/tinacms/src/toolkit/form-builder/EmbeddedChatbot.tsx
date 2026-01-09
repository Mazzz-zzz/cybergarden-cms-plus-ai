import React from 'react';
import { BiSend } from 'react-icons/bi';
import {
    AssistantRuntimeProvider,
    AssistantIf,
    ComposerPrimitive,
    MessagePrimitive,
    ThreadPrimitive,
    useLocalRuntime,
    useAssistantState,
    type ChatModelAdapter,
    type ThreadMessage,
} from '@assistant-ui/react';
import DiffMatchPatch from 'diff-match-patch';
import { Button } from '@toolkit/components/ui/button';
import { cn } from '../../utils/cn';

export type EmbeddedChatbotContext = {
    id: string;
    label: string;
    description?: string;
    value?: unknown;
    fieldName?: string;
    valueType?: 'text' | 'json' | 'rich-text';
};

type EmbeddedChatbotProps = {
    contexts?: EmbeddedChatbotContext[];
};

const OPENROUTER_KEY_STORAGE = 'tinacms.openrouterKey';
const OPENROUTER_MODEL_STORAGE = 'tinacms.openrouterModel';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const MAX_CONTEXT_CHARS = 50000;

const APPLY_EDIT_TOOL = {
    type: 'function',
    function: {
        name: 'apply_edit',
        description: 'Applies a search-and-replace edit to the current field content. Use this tool whenever the user asks you to edit, change, modify, or update the content.',
        parameters: {
            type: 'object',
            properties: {
                search: {
                    type: 'string',
                    description: 'The exact text segment to find and replace. Must match existing content.',
                },
                replace: {
                    type: 'string',
                    description: 'The new text to replace the search segment with.',
                },
            },
            required: ['search', 'replace'],
        },
    },
};

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
    const base =
        'You are a helpful TinaCMS editing assistant. When the user asks to edit, change, modify, or update content, you MUST use the `apply_edit` tool. Do NOT output raw text for edits. Only use the tool. For questions or clarifications, respond normally.';
    if (!context) return base;
    const clipped = preview
        ? preview.slice(0, MAX_CONTEXT_CHARS)
        : 'No content available.';
    const jsonHint =
        typeof context.value !== 'string'
            ? 'If the content is JSON, return valid JSON only.'
            : '';
    return [
        base,
        `Context source: ${context.label}.`,
        context.description ? `Description: ${context.description}` : '',
        jsonHint,
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

const getMessageText = (message: ThreadMessage) => {
    return message.content
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('')
        .trim();
};
type ChatbotApplyPayload = {
    fieldName: string;
    patchText: string;
    proposedText: string;
    valueType: 'text' | 'json' | 'rich-text';
};

const dispatchChatbotApply = (payload: ChatbotApplyPayload) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent('tinacms-chatbot-apply-context', { detail: payload })
    );
};

const extractProposedText = (text: string) => {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return (fenced ? fenced[1] : text).trim();
};

const serializeContextValue = (value: unknown) => {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value ?? '');
    }
};

const normalizeJsonCandidate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    const firstBrace = trimmed.indexOf('{');
    const firstBracket = trimmed.indexOf('[');
    const hasBrace =
        firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket);
    const start = hasBrace ? firstBrace : firstBracket;
    if (start === -1) return trimmed;
    const endChar = hasBrace ? '}' : ']';
    const end = trimmed.lastIndexOf(endChar);
    if (end === -1) return trimmed;
    return trimmed.slice(start, end + 1);
};

const applySearchReplaceBlock = (
    source: string,
    proposed: string
): string | null => {
    const searchMarker = '<<<<<<< SEARCH';
    const midMarker = '=======';
    const endMarker = '>>>>>>>';

    const searchStart = proposed.indexOf(searchMarker);
    if (searchStart === -1) return null;

    const midStart = proposed.indexOf(midMarker, searchStart);
    const endStart = proposed.indexOf(endMarker, midStart);

    if (midStart === -1 || endStart === -1) return null;

    const searchBlock = proposed
        .slice(searchStart + searchMarker.length, midStart)
        .trim();
    const replaceBlock = proposed
        .slice(midStart + midMarker.length, endStart)
        .trim();

    const dmp = new DiffMatchPatch();
    dmp.Match_Threshold = 0.5; // Allow some fuzziness
    dmp.Match_Distance = 1000;

    const loc = dmp.match_main(source, searchBlock, 0);
    if (loc === -1) return null;

    // We verified the location via fuzzy match, but we need the *exact* length of the match in source
    // match_main returns the start index.
    // However, since it's fuzzy, the length might differ slightly if we used dmp.match_bitap directly?
    // dmp.match_main relies on bitap.
    // To get exact replacement range, it's safer to trust the fuzzy finding or
    // if we want to be safe, we assume exact match at that location or re-verify.
    // Actually, simply replacing the block at 'loc' with length of 'searchBlock' is risky if fuzzy.
    // Better approach: Use patch_make with the specific change.

    // Instead of manual splicing, let's let DMP do the heavy lifting by creating a patch
    // that represents "Replace searchBlock with replaceBlock"
    // But we don't know where it is exactly in 'source' if it differs slightly.

    // Simpler fallback: If fuzzy match is good, we assume the text is roughly there.
    // But applying a patch blindly might be better.
    // Let's force an exact-ish replacement:

    // If we use dmp to find it, we can try to extract the "actual" text at that location
    // and see if it's close enough.
    // Current bitap implementation finds the best match.

    // Let's assume the user provided exact enough context.
    const before = source.slice(0, loc);
    // Find where the search block ends in source? 
    // This is hard with fuzzy matching.

    // Alternative: Create a patch from (searchBlock) -> (replaceBlock)
    // and try to apply it to (source) at the found location? No.

    // Best effort: Exact match check first.
    if (source.includes(searchBlock)) {
        return source.replace(searchBlock, replaceBlock);
    }

    // If not exact, rely on DMP patch for the whole file?
    // No, that fails if source is huge and we only have partial.
    // That's why we are doing this.

    // If fuzzy match found 'loc', we can try to "Delete" the text at 'loc' roughly size of searchBlock
    // and insert replaceBlock.
    // However, we should be careful. If the match is poor, we might check Match_Distance.

    // For now, if loc is found, we assume it's correct.
    return source.slice(0, loc) + replaceBlock + source.slice(loc + searchBlock.length);
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

type ChatApplyActionsProps = {
    context?: EmbeddedChatbotContext;
    currentValue?: unknown;
};

const getLatestAssistantText = (
    messages: readonly ThreadMessage[],
    valueType?: 'text' | 'json'
) => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role !== 'assistant') continue;
        const text = extractProposedText(getMessageText(message));
        if (!text) continue;
        if (valueType === 'json') {
            try {
                JSON.parse(normalizeJsonCandidate(text));
                return { text, id: message.id };
            } catch {
                continue;
            }
        }
        return { text, id: message.id };
    }
    return null;
};

const ChatApplyActions = ({ context, currentValue }: ChatApplyActionsProps) => {
    const messages = useAssistantState(({ thread }) => thread.messages);
    const lastAssistantResult = React.useMemo(
        () =>
            getLatestAssistantText(
                messages,
                context?.valueType === 'rich-text' ? 'text' : context?.valueType
            ),
        [messages, context?.valueType]
    );

    const [patchText, setPatchText] = React.useState<string | null>(null);
    const [proposedText, setProposedText] = React.useState('');
    const [applyError, setApplyError] = React.useState('');
    const [autoAppliedState, setAutoAppliedState] = React.useState<{
        messageId: string;
        originalValue: unknown;
    } | null>(null);

    // Reset auto-applied state if context changes
    React.useEffect(() => {
        setAutoAppliedState(null);
    }, [context?.fieldName]);

    React.useEffect(() => {
        if (!context?.fieldName || currentValue === undefined) {
            setPatchText(null);
            setProposedText('');
            setApplyError('');
            return;
        }
        if (!lastAssistantResult) {
            setPatchText(null);
            setProposedText('');
            setApplyError('');
            return;
        }
        const { text: lastAssistantText } = lastAssistantResult;

        // Skip tool success messages - they shouldn't be applied as content
        if (lastAssistantText.startsWith('✓') || lastAssistantText.includes('Applied edit:')) {
            setPatchText(null);
            setProposedText('');
            setApplyError('');
            return;
        }

        const sourceText = serializeContextValue(currentValue);
        const proposed = extractProposedText(lastAssistantText);
        if (!sourceText || !proposed) {
            setPatchText(null);
            setProposedText('');
            setApplyError('');
            return;
        }
        if (context.valueType === 'json') {
            try {
                const candidate = normalizeJsonCandidate(proposed);
                JSON.parse(candidate);
            } catch {
                setPatchText(null);
                setProposedText('');
                setApplyError('Assistant response is not valid JSON.');
                return;
            }
        }
        let text = '';
        const searchReplaceResult = applySearchReplaceBlock(sourceText, proposed);
        const isSearchBlock = proposed.includes('<<<<<<< SEARCH');

        const dmp = new DiffMatchPatch();

        if (searchReplaceResult) {
            const patches = dmp.patch_make(sourceText, searchReplaceResult);
            text = dmp.patch_toText(patches);
            setProposedText(searchReplaceResult);
            setPatchText(text);
        } else if (!isSearchBlock) {
            // Fallback for non-block edits (small text changes)
            const patches = dmp.patch_make(sourceText, proposed);
            text = dmp.patch_toText(patches);
            setProposedText(proposed);
            setPatchText(text);
        } else {
            // It looks like a search block but failed to parse/match.
            // Do NOT generate a fallback patch that wipes the file.
            // Keep previous patchText or clear it? Clear it to define "unable to apply".
            console.warn('Chatbot: Detected SEARCH block but failed to apply (incomplete or no match).');
            setPatchText(null);
            setProposedText('');
        }
        setApplyError('');
    }, [context?.fieldName, currentValue, lastAssistantResult]);

    // Auto-apply effect
    React.useEffect(() => {
        if (
            !context?.fieldName ||
            !patchText ||
            !proposedText ||
            !lastAssistantResult
        )
            return;

        // If we already applied this message, skip
        if (autoAppliedState?.messageId === lastAssistantResult.id) return;

        // Store original value and apply
        // Note: We need the *current* value to be the one before application
        // so we can revert. If 'currentValue' is updated from the apply,
        // we might lose the history if we aren't careful.
        // BUT, currentValue here *is* the value from the form.
        // If we apply, the form updates, and 'currentValue' changes.
        // So we must capture 'currentValue' BEFORE dispatching.
        const originalValue = currentValue;

        setAutoAppliedState({
            messageId: lastAssistantResult.id,
            originalValue,
        });

        const valueType =
            context?.valueType ||
            (typeof currentValue === 'string' ? 'text' : 'json');

        dispatchChatbotApply({
            fieldName: context.fieldName,
            patchText,
            proposedText,
            valueType,
        });
    }, [
        context?.fieldName,
        patchText,
        proposedText,
        lastAssistantResult,
        autoAppliedState?.messageId,
        // We don't depend on currentValue to trigger, but we use it.
        // To avoid loops, we check messageId.
    ]);

    const handleUndo = () => {
        if (!context?.fieldName || !autoAppliedState) return;

        // We need to revert to originalValue.
        // We can cheat and use the same apply mechanism but with a "reset" value?
        // Or we can construct a patch from (current) -> (original).
        // Or we can simplify and just set the value if we could...
        // But our mechanism is 'dispatchChatbotApply' which takes a patch.

        // Let's create a patch to revert.
        const sourceText = serializeContextValue(currentValue);
        const originalText = serializeContextValue(autoAppliedState.originalValue);
        const dmp = new DiffMatchPatch();
        const patches = dmp.patch_make(sourceText, originalText);
        const revertPatch = dmp.patch_toText(patches);

        const valueType =
            context?.valueType || (typeof currentValue === 'string' ? 'text' : 'json');

        dispatchChatbotApply({
            fieldName: context.fieldName,
            patchText: revertPatch,
            proposedText: originalText,
            valueType,
        });

        // Reset state so we can re-apply manually if desired?
        // Or just clear it.
        setAutoAppliedState(null);
    };

    const handleAccept = () => {
        setAutoAppliedState(null);
    };

    const isAutoApplied =
        autoAppliedState?.messageId === lastAssistantResult?.id;

    const canApply = Boolean(context?.fieldName && patchText && proposedText);
    const valueType =
        context?.valueType || (typeof currentValue === 'string' ? 'text' : 'json');

    if (!canApply || !context) return null;

    if (isAutoApplied) {
        return (
            <div className='mt-2 flex flex-col gap-1.5'>
                <div className='flex items-center gap-2'>
                    <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        onClick={handleUndo}
                    >
                        Undo Change
                    </Button>
                    <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={handleAccept}
                    >
                        Accept
                    </Button>
                    <span className='text-[11px] text-muted-foreground'>
                        Auto-applied.
                    </span>
                </div>
                {applyError ? (
                    <span className='text-[11px] text-red-600'>{applyError}</span>
                ) : null}
            </div>
        );
    }

    return (
        <div className='mt-2 flex flex-col gap-1.5'>
            <div className='flex items-center gap-2'>
                <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() =>
                        dispatchChatbotApply({
                            fieldName: context.fieldName!,
                            patchText: patchText!,
                            proposedText,
                            valueType,
                        })
                    }
                >
                    Apply to {context.label}
                </Button>
                <span className='text-[11px] text-muted-foreground'>
                    Updates the {context.label} field on the left.
                </span>
            </div>
            {applyError ? (
                <span className='text-[11px] text-red-600'>{applyError}</span>
            ) : null}
        </div>
    );
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
                        tools: [APPLY_EDIT_TOOL],
                        tool_choice: 'auto',
                    }),
                    signal: abortSignal,
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const message =
                        data?.error?.message || `OpenRouter error (${response.status})`;
                    throw new Error(message);
                }

                // Check for tool calls
                const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
                if (toolCall?.function?.name === 'apply_edit') {
                    try {
                        const args = JSON.parse(toolCall.function.arguments);
                        const { search, replace } = args;
                        if (search && typeof replace === 'string') {
                            // Dispatch the apply event
                            window.dispatchEvent(
                                new CustomEvent('tinacms-tool-apply-edit', {
                                    detail: { search, replace },
                                })
                            );
                            return { content: [{ type: 'text', text: `✓ Applied edit: replaced "${search.slice(0, 30)}..." with "${replace.slice(0, 30)}..."` }] };
                        }
                    } catch (e) {
                        console.error('Failed to parse apply_edit arguments:', e);
                    }
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
                        <ChatApplyActions
                            context={selectedContext}
                            currentValue={
                                selectedContext?.value !== undefined
                                    ? selectedContext.value
                                    : undefined
                            }
                        />
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
