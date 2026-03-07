/**
 * AdminAlerts.tsx — Trang cấu hình cảnh báo email theo site
 *
 * Features:
 * - Card per-site: bật/tắt, số ngày cảnh báo trước, recipients list
 * - Lịch sử gửi mail (alert_logs 15 record gần nhất)
 * - Nút "Gửi test ngay" → trigger Edge Function thủ công
 * - Toast khi lưu OK
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Bell, Save, Loader2, RefreshCw, Mail, CheckCircle2, AlertCircle, Clock, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { adminService, type AlertSettings, type AlertLog } from '../../services/adminService';
import { useToast, ToastContainer } from '../../components/Toast';

const ALL_SITES = ['RG1', 'RG2', 'RG3', 'RG5', 'CSVL'];

// -------------------------------------------------------
// Alert Settings Card (per site)
// -------------------------------------------------------
interface AlertCardProps {
    settings: AlertSettings;
    onSaved: () => void;
    addToast: ReturnType<typeof useToast>['addToast'];
}

const AlertCard: React.FC<AlertCardProps> = ({ settings, onSaved, addToast }) => {
    const [form, setForm] = useState<AlertSettings>({ ...settings });
    const [recipientInput, setRecipientInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [open, setOpen] = useState(false);

    const addRecipient = () => {
        const email = recipientInput.trim().toLowerCase();
        if (!email || form.recipients.includes(email)) return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            addToast('Email không hợp lệ.', 'error');
            return;
        }
        setForm(f => ({ ...f, recipients: [...f.recipients, email] }));
        setRecipientInput('');
    };

    const removeRecipient = (email: string) =>
        setForm(f => ({ ...f, recipients: f.recipients.filter(r => r !== email) }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await adminService.upsertAlertSettings(form);
            addToast(`Đã lưu cấu hình cảnh báo cho ${form.site_id}.`, 'success');
            onSaved();
        } catch (err: unknown) {
            addToast((err as Error).message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${form.enabled ? 'bg-success-50' : 'bg-gray-100'}`}>
                        <Bell className={`w-5 h-5 ${form.enabled ? 'text-success-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                        <h3 className="text-sm font-bold text-gray-900">{form.site_id}</h3>
                        <p className="text-xs text-gray-500">
                            {form.enabled
                                ? `Bật — cảnh báo trước ${form.days_before} ngày, ${form.recipients.length} người nhận`
                                : 'Tắt cảnh báo'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${form.enabled ? 'bg-success-50 text-success-700 border-success-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {form.enabled ? 'Bật' : 'Tắt'}
                    </span>
                    {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
            </button>

            {open && (
                <div className="px-5 pb-5 space-y-4 border-t border-gray-50">
                    {/* Bật/Tắt */}
                    <div className="flex items-center justify-between pt-4">
                        <label className="text-sm font-semibold text-gray-700">Bật cảnh báo email</label>
                        <button
                            onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enabled ? 'bg-success-500' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    {form.enabled && (
                        <>
                            {/* Số ngày cảnh báo trước */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">
                                    Cảnh báo trước (ngày): <strong className="text-primary-600">{form.days_before}</strong>
                                </label>
                                <input
                                    type="range"
                                    min={7} max={90} step={7}
                                    value={form.days_before}
                                    onChange={e => setForm(f => ({ ...f, days_before: parseInt(e.target.value) }))}
                                    className="w-full accent-primary-500"
                                />
                                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                                    <span>7 ngày</span><span>30 ngày</span><span>60 ngày</span><span>90 ngày</span>
                                </div>
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-2 gap-3">
                                <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={form.include_due_soon}
                                        onChange={e => setForm(f => ({ ...f, include_due_soon: e.target.checked }))}
                                        className="accent-primary-500 w-4 h-4"
                                    />
                                    <span className="text-xs font-medium text-gray-700">Sắp đến hạn</span>
                                </label>
                                <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={form.include_overdue}
                                        onChange={e => setForm(f => ({ ...f, include_overdue: e.target.checked }))}
                                        className="accent-primary-500 w-4 h-4"
                                    />
                                    <span className="text-xs font-medium text-gray-700">Đã quá hạn</span>
                                </label>
                            </div>

                            {/* Recipients */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-2">Người nhận email</label>
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        placeholder="name@company.com"
                                        value={recipientInput}
                                        onChange={e => setRecipientInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addRecipient()}
                                        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                                    />
                                    <button
                                        onClick={addRecipient}
                                        className="px-3 py-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-xl hover:bg-primary-100 text-sm font-semibold"
                                    >
                                        Thêm
                                    </button>
                                </div>
                                {form.recipients.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {form.recipients.map(r => (
                                            <span key={r} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 pl-2.5 pr-1.5 py-1 rounded-full">
                                                {r}
                                                <button onClick={() => removeRecipient(r)} className="text-gray-400 hover:text-red-500 ml-0.5 font-bold">×</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Save */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                    </button>
                </div>
            )}
        </div>
    );
};

// -------------------------------------------------------
// Alert Log Row
// -------------------------------------------------------
function LogRow({ log }: { log: AlertLog }) {
    const statusStyle = log.status === 'success'
        ? 'text-success-700'
        : log.status === 'partial'
            ? 'text-amber-600'
            : 'text-red-600';

    return (
        <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
            <div className="mt-0.5">
                {log.status === 'success'
                    ? <CheckCircle2 className="w-4 h-4 text-success-500" />
                    : log.status === 'partial'
                        ? <Clock className="w-4 h-4 text-amber-400" />
                        : <AlertCircle className="w-4 h-4 text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-800">{log.site_id}</span>
                    <span className={`text-xs font-semibold ${statusStyle}`}>{log.status.toUpperCase()}</span>
                    <span className="text-xs text-gray-400">{format(new Date(log.run_at), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                    Sắp hạn: {log.total_due_soon} · Quá hạn: {log.total_overdue}
                    {log.recipients.length > 0 && ` · Gửi tới: ${log.recipients.slice(0, 2).join(', ')}${log.recipients.length > 2 ? ` +${log.recipients.length - 2}` : ''}`}
                </p>
                {log.error && <p className="text-xs text-red-500 mt-0.5 truncate">{log.error}</p>}
            </div>
        </div>
    );
}

// -------------------------------------------------------
// Main Page
// -------------------------------------------------------
export const AdminAlerts: React.FC = () => {
    const { toasts, addToast, dismiss } = useToast();
    const [settings, setSettings] = useState<AlertSettings[]>([]);
    const [logs, setLogs] = useState<AlertLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [triggering, setTriggering] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [s, l] = await Promise.all([
                adminService.listAlertSettings(),
                adminService.listAlertLogs(),
            ]);
            // Đảm bảo có đủ setting cho tất cả site
            const merged = ALL_SITES.map(site => {
                const existing = s.find(x => x.site_id === site);
                return existing ?? {
                    site_id: site, enabled: false, days_before: 30,
                    recipients: [], include_due_soon: true, include_overdue: true
                };
            });
            setSettings(merged);
            setLogs(l);
        } catch {
            addToast('Không thể tải cấu hình cảnh báo.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    /** Gọi Edge Function thủ công để test */
    const handleTestSend = async () => {
        setTriggering(true);
        try {
            const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-alert-email`;
            const cronSecret = import.meta.env.VITE_CRON_SECRET;

            if (!cronSecret) {
                addToast('Chưa cấu hình VITE_CRON_SECRET. Không thể gửi test.', 'error');
                return;
            }

            const res = await fetch(edgeFnUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${cronSecret}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ dryRun: true }),
            });

            if (res.ok) {
                addToast('Gửi test email thành công! Kiểm tra hộp thư người nhận.', 'success');
                await loadData(); // reload logs
            } else {
                const msg = await res.text();
                addToast(`Lỗi gửi test: ${msg}`, 'error');
            }
        } catch {
            addToast('Không thể kết nối tới Edge Function.', 'error');
        } finally {
            setTriggering(false);
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto px-4 sm:px-6 pb-20">
            <ToastContainer toasts={toasts} onDismiss={dismiss} />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Bell className="w-6 h-6 text-primary-500" /> Cấu hình Cảnh báo Email
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Bật/tắt và cấu hình cảnh báo định kỳ theo từng nhà máy.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleTestSend}
                        disabled={triggering}
                        className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                        {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Gửi test
                    </button>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
                </div>
            ) : (
                <>
                    {/* Alert Settings Cards */}
                    <div className="space-y-3">
                        {settings.map(s => (
                            <AlertCard
                                key={s.site_id}
                                settings={s}
                                onSaved={loadData}
                                addToast={addToast}
                            />
                        ))}
                    </div>

                    {/* Alert Logs */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" /> Lịch sử gửi cảnh báo
                        </h3>
                        {logs.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-8">Chưa có lịch sử gửi cảnh báo nào.</p>
                        ) : (
                            <div>
                                {logs.map(log => <LogRow key={log.id} log={log} />)}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
