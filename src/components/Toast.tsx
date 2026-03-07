import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastProps {
    toast: ToastMessage;
    onDismiss: (id: string) => void;
}

const iconMap: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    warning: <Info className="w-5 h-5 text-amber-500 shrink-0" />,
};

const colorMap: Record<ToastType, string> = {
    success: 'bg-white border-emerald-200 shadow-emerald-100',
    error: 'bg-white border-red-200 shadow-red-100',
    info: 'bg-white border-blue-200 shadow-blue-100',
    warning: 'bg-white border-amber-200 shadow-amber-100',
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), 4000);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    return (
        <div
            className={`flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg ${colorMap[toast.type]} animate-slide-in-right min-w-[280px] max-w-sm`}
            role="alert"
        >
            {iconMap[toast.type]}
            <p className="text-sm font-medium text-gray-800 flex-1 leading-snug">{toast.message}</p>
            <button
                onClick={() => onDismiss(toast.id)}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 -mt-0.5"
                aria-label="Đóng"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

interface ToastContainerProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;
    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
            {toasts.map(t => (
                <Toast key={t.id} toast={t} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

// — Hook —
let _idCounter = 0;
export function useToast() {
    const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

    const addToast = React.useCallback((message: string, type: ToastType = 'info') => {
        const id = `toast-${++_idCounter}`;
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const dismiss = React.useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, addToast, dismiss };
}
