import * as React from 'react';
import { MdOutlineAutoAwesome } from 'react-icons/md';
import { createScreen } from '@toolkit/react-screens';
import { Button } from '@toolkit/components/ui/button';
import { Input } from '@toolkit/components/ui/input';

const OPENROUTER_KEY_STORAGE = 'tinacms.openrouterKey';
const OPENROUTER_MODEL_STORAGE = 'tinacms.openrouterModel';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

declare global {
  interface Window {
    __TINACMS_OPENROUTER_API_KEY?: string;
    __TINACMS_OPENROUTER_MODEL?: string;
  }
}

const AiSettings = () => {
  const [apiKey, setApiKey] = React.useState('');
  const [showKey, setShowKey] = React.useState(false);
  const [model, setModel] = React.useState(DEFAULT_MODEL);
  const [models, setModels] = React.useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  const [modelsError, setModelsError] = React.useState('');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedKey =
      window.localStorage.getItem(OPENROUTER_KEY_STORAGE) || '';
    const storedModel =
      window.localStorage.getItem(OPENROUTER_MODEL_STORAGE) || DEFAULT_MODEL;
    setApiKey(storedKey);
    setModel(storedModel || DEFAULT_MODEL);
    window.__TINACMS_OPENROUTER_API_KEY = storedKey || undefined;
    window.__TINACMS_OPENROUTER_MODEL = storedModel || DEFAULT_MODEL;
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!apiKey) {
      setModels([]);
      setModelsError('');
      return;
    }
    const controller = new AbortController();
    const loadModels = async () => {
      setModelsLoading(true);
      setModelsError('');
      try {
        const response = await fetch(OPENROUTER_MODELS_URL, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            data?.error?.message ||
            `Failed to load models (${response.status})`;
          throw new Error(message);
        }
        const ids = Array.isArray(data?.data)
          ? data.data
              .map((item: any) => item?.id)
              .filter((id: any) => typeof id === 'string')
          : [];
        const unique = Array.from(new Set(ids));
        unique.sort();
        setModels(unique);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setModelsError((error as Error).message || 'Failed to load models.');
          setModels([]);
        }
      } finally {
        setModelsLoading(false);
      }
    };
    loadModels();
    return () => controller.abort();
  }, [apiKey]);

  const saveSettings = () => {
    if (typeof window === 'undefined') return;
    if (apiKey) {
      window.localStorage.setItem(OPENROUTER_KEY_STORAGE, apiKey);
      window.__TINACMS_OPENROUTER_API_KEY = apiKey;
    } else {
      window.localStorage.removeItem(OPENROUTER_KEY_STORAGE);
      window.__TINACMS_OPENROUTER_API_KEY = undefined;
    }
    const sanitizedModel = model?.trim() || DEFAULT_MODEL;
    window.localStorage.setItem(OPENROUTER_MODEL_STORAGE, sanitizedModel);
    window.__TINACMS_OPENROUTER_MODEL = sanitizedModel;
    window.dispatchEvent(
      new CustomEvent('tinacms-openrouter-key', {
        detail: window.__TINACMS_OPENROUTER_API_KEY,
      })
    );
    window.dispatchEvent(
      new CustomEvent('tinacms-openrouter-model', {
        detail: window.__TINACMS_OPENROUTER_MODEL,
      })
    );
  };

  return (
    <div className='h-full w-full bg-white text-gray-900'>
      <div className='mx-auto flex h-full w-full max-w-3xl flex-col gap-6 px-8 py-8'>
        <div className='rounded-xl border border-gray-200 bg-white p-6 shadow-sm'>
          <h1 className='text-lg font-semibold'>AI Settings</h1>
          <p className='mt-2 text-sm text-gray-600'>
            Manage how AI uses your content when assisting edits.
          </p>
          <div className='mt-6 rounded-lg border border-gray-200 p-4'>
            <div className='flex flex-col gap-4'>
              <div>
                <p className='text-sm font-medium text-gray-900'>
                  OpenRouter API Key
                </p>
                <p className='text-xs text-gray-500'>
                  Stored locally in your browser only. Used by the chatbot.
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder='or-...'
                  className='h-9'
                />
                <Button
                  type='button'
                  variant='outline'
                  className='h-9'
                  onClick={() => setShowKey((prev) => !prev)}
                >
                  {showKey ? 'Hide' : 'Show'}
                </Button>
                <Button type='button' className='h-9' onClick={saveSettings}>
                  Save
                </Button>
              </div>
              <div className='text-xs text-gray-500'>
                {apiKey
                  ? 'Key saved locally.'
                  : 'No key saved. Chatbot send is disabled.'}
              </div>
              <div className='border-t border-gray-200 pt-3'>
                <p className='text-sm font-medium text-gray-900'>
                  Model (OpenRouter)
                </p>
                <p className='text-xs text-gray-500'>
                  Choose the model ID to use for chat.
                </p>
                <div className='mt-2 flex flex-col gap-2'>
                  <select
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className='h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none focus-visible:border-gray-400'
                    disabled={!apiKey || modelsLoading || models.length === 0}
                  >
                    {models.length === 0 ? (
                      <option value={DEFAULT_MODEL}>
                        {apiKey
                          ? modelsLoading
                            ? 'Loading models...'
                            : 'No models loaded'
                          : 'Add API key to load models'}
                      </option>
                    ) : null}
                    {models.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                  {modelsError ? (
                    <span className='text-xs text-red-600'>{modelsError}</span>
                  ) : (
                    <span className='text-[11px] text-gray-500'>
                      {modelsLoading
                        ? 'Fetching models from OpenRouter...'
                        : `${models.length} models loaded.`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className='mt-6 space-y-3 text-sm text-gray-700'>
            <div className='flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3'>
              <div>
                <p className='font-medium'>Context sources</p>
                <p className='text-xs text-gray-500'>
                  Choose which fields can be passed into the chatbot.
                </p>
              </div>
              <span className='text-xs text-gray-500'>Coming soon</span>
            </div>
            <div className='flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3'>
              <div>
                <p className='font-medium'>Tone & style</p>
                <p className='text-xs text-gray-500'>
                  Control voice, formatting, and verbosity.
                </p>
              </div>
              <span className='text-xs text-gray-500'>Coming soon</span>
            </div>
            <div className='flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3'>
              <div>
                <p className='font-medium'>Safety</p>
                <p className='text-xs text-gray-500'>
                  Set guardrails for suggestions and edits.
                </p>
              </div>
              <span className='text-xs text-gray-500'>Coming soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AiSettingsScreenPlugin = createScreen({
  name: 'AI Settings',
  Component: AiSettings,
  Icon: MdOutlineAutoAwesome,
  layout: 'fullscreen',
  navCategory: 'Site',
});
