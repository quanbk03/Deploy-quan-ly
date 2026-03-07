import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { user } = useAuth();
    const navigate = useNavigate();

    if (user) {
        return <Navigate to="/tong-quan" replace />;
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError('Đăng nhập thất bại: ' + error.message);
            setLoading(false);
        } else {
            navigate('/tong-quan');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-white/40">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 mb-4 transform -rotate-6 hover:rotate-0 transition-transform duration-300">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">HSE Equipment Manager</h2>
                    <p className="text-slate-500 mt-2 text-center text-sm font-medium">
                        Quản lý Thiết bị Kiểm định<br />Nghiêm ngặt &amp; YCNN đa nhà máy
                    </p>
                </div>

                {error && (
                    <div className="bg-danger-50 text-danger-700 p-4 rounded-xl text-sm font-medium mb-6 border border-danger-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="email">
                            Địa chỉ Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            autoComplete="email"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                            placeholder="user@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="password">
                            Mật khẩu
                        </label>
                        <input
                            id="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center py-4 px-4 mt-8 border border-transparent rounded-2xl shadow-[0_8px_30px_rgba(79,70,229,0.3)] text-sm font-bold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(79,70,229,0.4)] focus:outline-none focus:ring-4 focus:ring-primary-500/50 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed group uppercase tracking-wider"
                    >
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <span className="group-hover:translate-x-1 transition-transform">Đăng nhập</span>
                        )}
                    </button>
                </form>
            </div>

            {/* Background decoration */}
            <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
            <div className="fixed top-[20%] right-[-10%] w-96 h-96 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>
        </div>
    );
};
