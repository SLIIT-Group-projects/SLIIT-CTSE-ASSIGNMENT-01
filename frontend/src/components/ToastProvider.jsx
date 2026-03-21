import React from 'react';

const ToastContext = React.createContext({ notify: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);

  const notify = React.useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
              toast.type === 'error'
                ? 'bg-red-500'
                : toast.type === 'success'
                  ? 'bg-[#14967F]'
                  : 'bg-[#191919]'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

