import React, { useMemo, useState } from 'react';

type ChatbotProps = {
  iframeSrc?: string;
  buttonLabel?: string;
  title?: string;
};

declare global {
  interface Window {
    __TINACMS_CHATBOT_URL?: string;
  }
}

const DEFAULT_SRC_DOC = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; font-family: Inter, system-ui, -apple-system, sans-serif; background: #f9fafb; color: #111827; }
      .wrap { height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; padding: 24px; }
      .card { background: #ffffff; border-radius: 12px; border: 1px solid rgba(0,0,0,0.08); padding: 16px 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); }
      .title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
      .body { font-size: 13px; color: #6b7280; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="title">AI Chatbot</div>
        <div class="body">Provide a chatbot URL to load a live assistant.</div>
      </div>
    </div>
  </body>
</html>`;

const Chatbot = ({
  iframeSrc,
  buttonLabel = 'AI Chat',
  title = 'AI Chatbot',
}: ChatbotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const resolvedSrc = useMemo(() => {
    if (iframeSrc) return iframeSrc;
    if (typeof window !== 'undefined' && window.__TINACMS_CHATBOT_URL) {
      return window.__TINACMS_CHATBOT_URL;
    }
    return '';
  }, [iframeSrc]);

  const iframeProps = resolvedSrc
    ? { src: resolvedSrc }
    : { srcDoc: DEFAULT_SRC_DOC };

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 10000,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {isOpen ? (
        <div
          style={{
            width: 360,
            height: 520,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 120px)',
            marginBottom: 12,
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              height: 44,
              background: '#111827',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <span>{title}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chatbot"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#ffffff',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              X
            </button>
          </div>
          <iframe
            id="tinacms-chatbot-frame"
            title={title}
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              background: '#f9fafb',
            }}
            {...iframeProps}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="tinacms-chatbot-frame"
        style={{
          height: 48,
          padding: '0 18px',
          borderRadius: 999,
          border: 'none',
          background: '#111827',
          color: '#ffffff',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.2px',
          cursor: 'pointer',
          boxShadow: '0 12px 30px rgba(17, 24, 39, 0.35)',
        }}
      >
        {isOpen ? 'Close' : buttonLabel}
      </button>
    </div>
  );
};

export default Chatbot;
