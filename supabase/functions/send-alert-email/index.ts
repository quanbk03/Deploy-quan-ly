/**
 * send-alert-email/index.ts — Supabase Edge Function
 *
 * Gửi email cảnh báo kiểm định hàng ngày.
 *
 * Security:
 * - Kiểm tra Authorization: Bearer <CRON_SECRET>
 * - Secret chỉ nằm ở backend (Supabase Edge Function Secrets)
 * - Frontend không bao giờ nhìn thấy RESEND_API_KEY hoặc CRON_SECRET
 *
 * ENV vars (set trong Supabase Dashboard → Project Settings → Edge Functions):
 *   RESEND_API_KEY      — API key của Resend.com
 *   CRON_SECRET         — Secret dùng để xác thực cron job / GitHub Actions
 *   SUPABASE_URL        — URL project (auto-set by Supabase)
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (auto-set by Supabase)
 *
 * Body JSON (optional):
 *   { dryRun: true }  — Chỉ log, không gửi email thật
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// -------------------------------------------------------
// Config
// -------------------------------------------------------
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? 'change-me-in-production';
const FROM_EMAIL = Deno.env.get('ALERT_FROM_EMAIL') ?? 'hse-alert@yourcompany.com';
const MAX_ROWS_PER_EMAIL = 15;  // chỉ hiển thị tối đa N row trong bảng email

// -------------------------------------------------------
// Types
// -------------------------------------------------------
interface AssetRow {
    asset_code: string;
    equipment_name: string;
    location: string | null;
    next_due_date: string | null;
    days_diff: number;  // âm = overdue, dương = còn N ngày
}

interface AlertSetting {
    site_id: string;
    enabled: boolean;
    days_before: number;
    recipients: string[];
    include_due_soon: boolean;
    include_overdue: boolean;
}

// -------------------------------------------------------
// Email HTML Builder
// -------------------------------------------------------
function buildEmailHtml(
    siteId: string,
    dueSoon: AssetRow[],
    overdue: AssetRow[],
    runDate: string,
): string {
    const formatRow = (a: AssetRow, type: 'due_soon' | 'overdue') => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:8px 12px;font-family:monospace;font-size:13px;">${a.asset_code}</td>
      <td style="padding:8px 12px;font-size:13px;">${a.equipment_name}</td>
      <td style="padding:8px 12px;font-size:12px;color:#666;">${a.location ?? '-'}</td>
      <td style="padding:8px 12px;font-size:12px;">${a.next_due_date ?? '-'}</td>
      <td style="padding:8px 12px;font-size:12px;font-weight:bold;color:${type === 'overdue' ? '#dc2626' : '#d97706'};">
        ${type === 'overdue' ? `Quá ${Math.abs(a.days_diff)} ngày` : `Còn ${a.days_diff} ngày`}
      </td>
    </tr>`;

    const tableStyle = `width:100%;border-collapse:collapse;margin-top:10px;`;
    const thStyle = `padding:8px 12px;text-align:left;font-size:11px;color:#666;background:#f9fafb;border-bottom:1px solid #e5e7eb;text-transform:uppercase;`;

    const buildTable = (rows: AssetRow[], type: 'due_soon' | 'overdue', extra: number) => `
    <table style="${tableStyle}">
      <thead><tr>
        <th style="${thStyle}">Mã TB</th>
        <th style="${thStyle}">Tên thiết bị</th>
        <th style="${thStyle}">Vị trí</th>
        <th style="${thStyle}">Hạn KĐ</th>
        <th style="${thStyle}">Trạng thái</th>
      </tr></thead>
      <tbody>
        ${rows.map(a => formatRow(a, type)).join('')}
        ${extra > 0 ? `<tr><td colspan="5" style="padding:8px 12px;font-size:12px;color:#666;font-style:italic;">...và ${extra} thiết bị khác</td></tr>` : ''}
      </tbody>
    </table>`;

    const overdueSection = overdue.length > 0 ? `
    <h3 style="color:#dc2626;font-size:15px;margin-top:30px;">🔴 Quá hạn kiểm định (${overdue.length} thiết bị)</h3>
    ${buildTable(overdue.slice(0, MAX_ROWS_PER_EMAIL), 'overdue', Math.max(0, overdue.length - MAX_ROWS_PER_EMAIL))}` : '';

    const dueSoonSection = dueSoon.length > 0 ? `
    <h3 style="color:#d97706;font-size:15px;margin-top:30px;">🟡 Sắp đến hạn kiểm định (${dueSoon.length} thiết bị)</h3>
    ${buildTable(dueSoon.slice(0, MAX_ROWS_PER_EMAIL), 'due_soon', Math.max(0, dueSoon.length - MAX_ROWS_PER_EMAIL))}` : '';

    return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;margin:0;padding:0;background:#f9fafb;">
  <div style="max-width:720px;margin:24px auto;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;">
    
    <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:28px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">🏭 HSE Alert — ${siteId}</h1>
      <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;">Ngày chạy: ${runDate}</p>
    </div>

    <div style="padding:28px 32px;">
      <div style="background:#f1f5f9;border-radius:12px;padding:16px 20px;display:flex;gap:24px;flex-wrap:wrap;">
        <div><strong style="font-size:24px;color:#dc2626;">${overdue.length}</strong><br/><span style="font-size:12px;color:#666;">Quá hạn</span></div>
        <div><strong style="font-size:24px;color:#d97706;">${dueSoon.length}</strong><br/><span style="font-size:12px;color:#666;">Sắp đến hạn</span></div>
      </div>

      ${overdueSection}
      ${dueSoonSection}

      ${overdue.length === 0 && dueSoon.length === 0 ? '<p style="color:#16a34a;font-weight:600;margin-top:20px;">✅ Không có thiết bị cần cảnh báo.</p>' : ''}
    </div>

    <div style="padding:16px 32px;border-top:1px solid #f0f4f8;background:#f9fafb;">
      <p style="font-size:11px;color:#9ca3af;margin:0;">Email này được gửi tự động bởi hệ thống HSE Equipment Manager. Không reply trực tiếp.</p>
    </div>
  </div>
</body>
</html>`;
}

// -------------------------------------------------------
// Main Handler
// -------------------------------------------------------
Deno.serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }
        });
    }

    // Auth check
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (token !== CRON_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    let dryRun = false;
    try {
        const body = await req.json();
        dryRun = body?.dryRun === true;
    } catch { /* no body */ }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const runAt = new Date().toISOString();
    const runDateVi = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const results: { site: string; status: string; error?: string }[] = [];

    try {
        // Lấy tất cả alert_settings đang enabled
        const { data: settingsData } = await supabase
            .from('alert_settings')
            .select('*')
            .eq('enabled', true);

        const settingsList: AlertSetting[] = settingsData ?? [];

        for (const setting of settingsList) {
            let totalDueSoon = 0, totalOverdue = 0;
            const log: { site_id: string; run_at: string; total_due_soon: number; total_overdue: number; recipients: string[]; status: string; error?: string } = {
                site_id: setting.site_id,
                run_at: runAt,
                total_due_soon: 0,
                total_overdue: 0,
                recipients: setting.recipients,
                status: 'success',
            };

            try {
                const today = new Date().toISOString().split('T')[0];
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() + setting.days_before);
                const cutoffStr = cutoff.toISOString().split('T')[0];

                // Overdue
                const overdueRows: AssetRow[] = [];
                if (setting.include_overdue) {
                    const { data } = await supabase
                        .from('assets')
                        .select('asset_code, equipment_name, location, next_due_date')
                        .eq('site_id', setting.site_id)
                        .lt('next_due_date', today)
                        .not('next_due_date', 'is', null)
                        .neq('status', 'decommissioned')
                        .order('next_due_date', { ascending: true });

                    (data ?? []).forEach(a => {
                        const diff = Math.round((new Date(a.next_due_date).getTime() - Date.now()) / 86400000);
                        overdueRows.push({ asset_code: a.asset_code, equipment_name: a.equipment_name, location: a.location, next_due_date: a.next_due_date, days_diff: diff });
                    });
                    totalOverdue = overdueRows.length;
                }

                // Due soon
                const dueSoonRows: AssetRow[] = [];
                if (setting.include_due_soon) {
                    const { data } = await supabase
                        .from('assets')
                        .select('asset_code, equipment_name, location, next_due_date')
                        .eq('site_id', setting.site_id)
                        .gte('next_due_date', today)
                        .lte('next_due_date', cutoffStr)
                        .neq('status', 'decommissioned')
                        .order('next_due_date', { ascending: true });

                    (data ?? []).forEach(a => {
                        const diff = Math.round((new Date(a.next_due_date).getTime() - Date.now()) / 86400000);
                        dueSoonRows.push({ asset_code: a.asset_code, equipment_name: a.equipment_name, location: a.location, next_due_date: a.next_due_date, days_diff: diff });
                    });
                    totalDueSoon = dueSoonRows.length;
                }

                log.total_due_soon = totalDueSoon;
                log.total_overdue = totalOverdue;

                // Gửi email nếu có gì để báo cáo và không phải dry run
                if (!dryRun && setting.recipients.length > 0 && (totalDueSoon + totalOverdue > 0)) {
                    const html = buildEmailHtml(setting.site_id, dueSoonRows, overdueRows, runDateVi);
                    const subject = `[HSE Alert][${setting.site_id}] ${totalOverdue > 0 ? `${totalOverdue} thiết bị QUÁ HẠN` : ''} ${totalDueSoon > 0 ? `${totalDueSoon} sắp đến hạn` : ''}`.trim();

                    const emailResp = await fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${RESEND_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            from: FROM_EMAIL,
                            to: setting.recipients,
                            subject,
                            html,
                        }),
                    });

                    if (!emailResp.ok) {
                        const errText = await emailResp.text();
                        throw new Error(`Resend API error: ${errText}`);
                    }
                }

                results.push({ site: setting.site_id, status: 'success' });
            } catch (siteErr: unknown) {
                log.status = 'error';
                log.error = (siteErr as Error).message;
                results.push({ site: setting.site_id, status: 'error', error: (siteErr as Error).message });
            }

            // Ghi log (kể cả dry run)
            await supabase.from('alert_logs').insert(log);
        }

        return new Response(JSON.stringify({ success: true, dryRun, results }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: unknown) {
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
});
