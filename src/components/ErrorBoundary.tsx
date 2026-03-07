import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Lỗi không xử lý được:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/tong-quan';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl shadow-lg border border-red-100 p-10 max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Đã xảy ra lỗi</h1>
                        <p className="text-gray-500 text-sm mb-2">
                            Ứng dụng gặp sự cố không mong muốn. Vui lòng thử tải lại trang hoặc quay về màn hình chính.
                        </p>
                        {this.state.error?.message && (
                            <div className="bg-red-50 rounded-xl p-3 mb-6 text-left border border-red-100">
                                <p className="text-xs text-red-700 font-mono break-words">{this.state.error.message}</p>
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={this.handleReload}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Tải lại trang
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Về Tổng quan
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
