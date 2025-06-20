import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps extends Toast {
  onClose: (id: string) => void;
}

function ToastComponent({ id, type, title, message, duration = 4000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info
  };

  const colors = {
    success: 'bg-green-500/10 border-green-500/20 text-green-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400'
  };

  const Icon = icons[type];

  return (
    <div className={`flex items-start space-x-3 p-4 rounded-lg border ${colors[type]} animate-in slide-in-from-right duration-300 shadow-lg backdrop-blur-sm`}>
      <Icon size={20} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{title}</p>
        {message && (
          <p className="text-sm opacity-90 mt-1">{message}</p>
        )}
      </div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity duration-200"
      >
        <X size={16} />
      </button>
    </div>
  );
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    
    // Prevent duplicate toasts with the same title
    setToasts(prev => {
      const existingToast = prev.find(t => t.title === toast.title);
      if (existingToast) {
        return prev; // Don't add duplicate
      }
      return [...prev, { ...toast, id }];
    });
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Container - Positioned to avoid header overlap */}
      <div className="fixed top-24 right-4 z-40 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastComponent
              {...toast}
              onClose={removeToast}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}