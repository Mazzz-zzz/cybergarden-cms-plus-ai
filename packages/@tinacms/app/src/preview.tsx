/**

*/
import React from 'react';
import { defineConfig, EmbeddedChatbot } from 'tinacms';
import { useGraphQLReducer } from './lib/graphql-reducer';

type Config = Parameters<typeof defineConfig>[0];

export const Preview = (
  props: Config & {
    url: string;
    iframeRef: React.MutableRefObject<HTMLIFrameElement>;
  }
) => {
  useGraphQLReducer(props.iframeRef, props.url);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <iframe
        data-test='tina-iframe'
        id='tina-iframe'
        ref={props.iframeRef}
        className='h-screen w-full bg-white'
        src={props.url}
      />
      <DraggableChatbotOverlay />
    </div>
  );
};

const DraggableChatbotOverlay = () => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragging = React.useRef(false);
  const offset = React.useRef({ x: 0, y: 0 });
  const [position, setPosition] = React.useState({ x: 24, y: 24, ready: false });
  const [contexts, setContexts] = React.useState<
    {
      id: string;
      label: string;
      description?: string;
      value?: unknown;
    }[]
  >([]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Array.isArray(window.__TINACMS_CHATBOT_CONTEXTS)) {
      setContexts(window.__TINACMS_CHATBOT_CONTEXTS);
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (Array.isArray(detail)) {
        setContexts(detail);
      }
    };
    window.addEventListener('tinacms-chatbot-contexts', handler);
    return () => window.removeEventListener('tinacms-chatbot-contexts', handler);
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || position.ready) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(8, window.innerWidth - rect.width - 24);
    const y = Math.max(8, window.innerHeight - rect.height - 24);
    setPosition({ x, y, ready: true });
  }, [position.ready]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragging.current = true;
    offset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const el = containerRef.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);
    const x = Math.min(Math.max(8, event.clientX - offset.current.x), maxX);
    const y = Math.min(Math.max(8, event.clientY - offset.current.y), maxY);
    setPosition((prev) => ({ ...prev, x, y }));
  };

  const onPointerUp = () => {
    dragging.current = false;
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10,
        maxWidth: 'calc(100% - 16px)',
        touchAction: 'none',
      }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          cursor: 'grab',
          background: '#111827',
          color: '#ffffff',
          padding: '6px 10px',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.2px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          userSelect: 'none',
        }}
        aria-label='Drag chatbot'
      >
        Drag
      </div>
      <div style={{ marginTop: 0 }}>
        <EmbeddedChatbot contexts={contexts} />
      </div>
    </div>
  );
};
