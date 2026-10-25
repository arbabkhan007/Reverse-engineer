import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/* ------------------------------------------------------------------ toast */

interface ToastValue {
  show: (message: string) => void;
}
const ToastContext = createContext<ToastValue>({ show: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((next: string) => {
    setMessage(next);
  }, []);

  useEffect(() => {
    if (message === null) return;
    const timer = window.setTimeout(() => setMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {message !== null && (
        <div className="toast" role="status" aria-live="polite">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  return useContext(ToastContext);
}

/* ------------------------------------------------------------------ chips */

export function Chip({
  children,
  tone = 'default',
  outline,
}: {
  children: ReactNode;
  tone?: 'default' | 'terracotta' | 'sage' | 'mustard' | 'rose' | 'sky';
  outline?: boolean;
}) {
  const classes = ['chip'];
  if (tone !== 'default') classes.push(tone);
  if (outline) classes.push('outline');
  return <span className={classes.join(' ')}>{children}</span>;
}

export function LevelChip({ level }: { level: string }) {
  const tone = level === 'beginner' ? 'sage' : level === 'easy' ? 'sky' : level === 'intermediate' ? 'mustard' : 'rose';
  return <Chip tone={tone as 'sage'}>{level}</Chip>;
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <span className="spacer" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
        {footer && <div className="row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}