/**
 * assetHelpers.ts
 * Các hàm helper dùng chung cho toàn bộ app — chuẩn hóa tính toán và hiển thị.
 * Không import từ services hay components để tránh circular dependency.
 */

// -------------------------------------------------------
// TYPE EXPORTS — Canonical enums
// -------------------------------------------------------

export type AssetStatus = 'in_service' | 'out_of_service' | 'locked' | 'scrapped';
export type DeclaredStatus = 'declared' | 'not_declared' | 'not_required';
export type DueStatusType = 'ok' | 'due_soon' | 'overdue';
export type EventType = 'planned' | 'periodic' | 'after_repair' | 'maintenance';
export type EventStatus = 'planned' | 'done' | 'verified';
export type EventResult = 'pass' | 'conditional' | 'fail' | 'unknown';
export type DocType =
    | 'certificate'
    | 'report'
    | 'checklist'
    | 'invoice'
    | 'declaration_letter'
    | 'legal_confirmation';

export type UserRole = 'admin' | 'hse' | 'engineering' | 'viewer';

// -------------------------------------------------------
// computeDueStatus — Nguồn duy nhất tính trạng thái hạn KĐ
// -------------------------------------------------------

/**
 * Tính trạng thái hạn kiểm định từ next_due_date.
 * @param nextDueDate - ISO date string (YYYY-MM-DD) hoặc null
 * @param dueSoonDays - số ngày còn lại để cảnh báo (mặc định 30)
 */
export function computeDueStatus(
    nextDueDate: string | null,
    dueSoonDays = 30
): DueStatusType {
    if (!nextDueDate) return 'ok';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(nextDueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((due.getTime() - now.getTime()) / 86_400_000);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= dueSoonDays) return 'due_soon';
    return 'ok';
}

/**
 * Tính số ngày còn lại / quá hạn từ next_due_date.
 * Dương = còn lại. Âm = đã quá.
 */
export function daysUntilDue(nextDueDate: string | null): number | null {
    if (!nextDueDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(nextDueDate);
    due.setHours(0, 0, 0, 0);
    return Math.floor((due.getTime() - now.getTime()) / 86_400_000);
}

// -------------------------------------------------------
// Label helpers — Tiếng Việt cho UI
// -------------------------------------------------------

const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
    in_service: 'Đang hoạt động',
    out_of_service: 'Ngừng hoạt động',
    locked: 'Đã khóa',
    scrapped: 'Thanh lý',
};

export function getAssetStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Không rõ';
    return ASSET_STATUS_LABELS[status as AssetStatus] ?? status;
}

const DECLARED_STATUS_LABELS: Record<DeclaredStatus, string> = {
    declared: 'Đã khai báo',
    not_declared: 'Chưa khai báo',
    not_required: 'Không yêu cầu',
};

export function getDeclaredStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Chưa khai báo';
    return DECLARED_STATUS_LABELS[status as DeclaredStatus] ?? status;
}

const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
    planned: 'Kế hoạch',
    done: 'Đã thực hiện',
    verified: 'Đã duyệt',
};

export function getEventStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Không rõ';
    return EVENT_STATUS_LABELS[status as EventStatus] ?? status;
}

const EVENT_RESULT_LABELS: Record<EventResult, string> = {
    pass: 'Đạt',
    conditional: 'Đạt có điều kiện',
    fail: 'Không đạt',
    unknown: 'Chưa xác định',
};

export function getEventResultLabel(result: string | null | undefined): string {
    if (!result) return 'Chưa xác định';
    return EVENT_RESULT_LABELS[result as EventResult] ?? result;
}

const DUE_STATUS_LABELS: Record<DueStatusType, string> = {
    ok: 'Còn hạn',
    due_soon: 'Sắp đến hạn',
    overdue: 'Quá hạn',
};

export function getDueStatusLabel(status: DueStatusType): string {
    return DUE_STATUS_LABELS[status];
}

// -------------------------------------------------------
// Role helpers
// -------------------------------------------------------

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Quản trị viên',
    hse: 'HSE',
    engineering: 'Kỹ thuật',
    viewer: 'Người xem',
};

export function getRoleLabel(role: string | null | undefined): string {
    if (!role) return 'Không rõ';
    return ROLE_LABELS[role as UserRole] ?? role;
}

/**
 * Kiểm tra role có quyền chỉnh sửa không
 */
export function canEdit(role: string | null | undefined): boolean {
    return role === 'admin' || role === 'hse' || role === 'engineering';
}

// -------------------------------------------------------
// normalizeIntervalMonths — parse interval text → number
// -------------------------------------------------------

/**
 * Parse interval_text hoặc interval_months thành số tháng.
 * Hỗ trợ: "12", "6", "custom" (trả về null), hoặc number trực tiếp.
 */
export function normalizeIntervalMonths(
    intervalText: string | null | undefined,
    fallback: number | null = 12
): number | null {
    if (!intervalText) return fallback;
    if (intervalText === 'custom') return null;
    const parsed = parseInt(intervalText, 10);
    return isNaN(parsed) ? fallback : parsed;
}

// -------------------------------------------------------
// formatDaysRemaining — hiển thị số ngày đến hạn
// -------------------------------------------------------

export function formatDaysRemaining(days: number | null): string {
    if (days === null) return 'Chưa có hạn';
    if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
    if (days === 0) return 'Đến hạn hôm nay';
    return `Còn ${days} ngày`;
}
