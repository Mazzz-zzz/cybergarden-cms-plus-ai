import * as React from 'react';
import { MdOutlineAutoAwesome } from 'react-icons/md';
import { createScreen } from '@toolkit/react-screens';
import { Button } from '@toolkit/components/ui/button';
import { Input } from '@toolkit/components/ui/input';

const OPENROUTER_KEY_STORAGE = 'tinacms.openrouterKey';

declare global {
  interface Window {
    __TINACMS_OPENROUTER_API_KEY?: string;
  }
}

const AiSettings = () => {
  const [apiKey, setApiKey] = React.useState('');
  const [showKey, setShowKey] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(OPENROUTER_KEY_STORAGE) || '';
    setApiKey(stored);
    window.__TINACMS_OPENROUTER_API_KEY = stored || undefined;
  }, []);

  const saveKey = () => {
    if (typeof window === 'undefined') return;
    if (apiKey) {
      window.localStorage.setItem(OPENROUTER_KEY_STORAGE, apiKey);
      window.__TINACMS_OPENROUTER_API_KEY = apiKey;
    } else {
      window.localStorage.removeItem(OPENROUTER_KEY_STORAGE);
      window.__TINACMS_OPENROUTER_API_KEY = undefined;
    }
    window.dispatchEvent(
      new CustomEvent('tinacms-openrouter-key', {
        detail: window.__TINACMS_OPENROUTER_API_KEY,
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
            <div className='flex flex-col gap-3'>
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
                <Button type='button' className='h-9' onClick={saveKey}>
                  Save
                </Button>
              </div>
              <div className='text-xs text-gray-500'>
                {apiKey
                  ? 'Key saved locally.'
                  : 'No key saved. Chatbot send is disabled.'}
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
