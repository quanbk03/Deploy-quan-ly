/**
 * database.ts — Canonical TypeScript types cho toàn bộ app
 *
 * Nguồn chuẩn hóa:
 * - Tất cả enum imports từ assetHelpers.ts (đây là source of truth cho types)
 * - UI dùng helper functions từ assetHelpers.ts để format tiếng Việt
 * - Không dùng 'any' cho các field nghiệp vụ cốt lõi
 */

// Re-export canonical enums từ assetHelpers để các file khác import 1 chỗ duy nhất
export type {
    AssetStatus,
    DeclaredStatus,
    DueStatusType,
    EventType,
    EventStatus,
    EventResult,
    DocType,
    UserRole,
} from '../utils/assetHelpers';

// -------------------------------------------------------
// PROFILE
// -------------------------------------------------------

export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    /** Canonical enum từ assetHelpers.ts */
    role: 'admin' | 'hse' | 'engineering' | 'viewer';
    site_id: string;
}

// -------------------------------------------------------
// SITE
// -------------------------------------------------------

export interface Site {
    id: string;
    name: string;
    created_at: string;
}

export interface SiteSetting {
    site_id: string;
    due_soon_days: number;
    overdue_lock_enabled: boolean;
    updated_at: string;
}

// -------------------------------------------------------
// EQUIPMENT CATEGORY
// -------------------------------------------------------

export interface EquipmentCategory {
    id: string;
    sort_order: number;
    created_at: string;
    code: string | null;
    label_short: string;
    label_full: string;
    aliases: string[] | null;
}

// -------------------------------------------------------
// ASSET — Source of Truth cho mọi thiết bị
// -------------------------------------------------------

export interface Asset {
    // Định danh
    id: string;
    asset_code: string;
    site_id: string;

    // Thông tin thiết bị
    equipment_name: string | null;
    /** Tên loại kỹ thuật: "Thiết bị chịu áp", "Thiết bị nâng hạ", v.v. */
    equipment_type: string;
    /** Label danh mục (free-text, không còn enforce FK). Ưu tiên dùng equipment_type nếu empty. */
    equipment_category: string | null;
    description_raw: string | null;
    location: string | null;
    serial_or_model: string | null;
    serial: string | null;
    model: string | null;
    year_made: number | null;
    manufacturer: string | null;
    working_pressure: string | null;
    capacity_or_rating: string | null;
    is_strict_required: boolean;

    /** @see AssetStatus trong assetHelpers.ts */
    status: 'in_service' | 'out_of_service' | 'locked' | 'scrapped';

    // Thông tin kiểm định
    last_inspection_date: string | null;
    next_due_date: string | null;
    interval_months: number | null;
    interval_text: string | null;
    stamp_no: string | null;
    inspection_agency: string | null;

    // Thông tin khai báo
    /** @see DeclaredStatus trong assetHelpers.ts: 'declared' | 'not_declared' | 'not_required' */
    declared_status: string | null;
    declaration_doc_no: string | null;

    // Metadata
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// -------------------------------------------------------
// ASSET EVENT — Lịch sử kiểm định từng lần
// -------------------------------------------------------

export interface AssetEvent {
    id: string;
    asset_id: string;

    /** @see EventType trong assetHelpers.ts */
    event_type: 'planned' | 'periodic' | 'after_repair' | 'maintenance';
    interval_months: number | null;
    planned_date: string | null;
    performed_date: string | null;

    /** @see EventResult trong assetHelpers.ts */
    result: 'pass' | 'conditional' | 'fail' | 'unknown' | null;
    stamp_no: string | null;
    /** Cơ quan thực hiện KĐ trong lần này */
    agency: string | null;
    notes: string | null;
    next_due_date: string | null;

    /** @see EventStatus trong assetHelpers.ts */
    status: 'planned' | 'done' | 'verified';

    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// -------------------------------------------------------
// ASSET DOCUMENT — Hồ sơ tài liệu
// -------------------------------------------------------

export interface AssetDocument {
    id: string;
    asset_id: string;
    event_id: string | null;

    /** @see DocType trong assetHelpers.ts */
    doc_type: string;
    doc_no: string | null;
    /** Tiêu đề do người dùng nhập khi upload */
    title: string | null;
    /** Ghi chú thêm */
    description: string | null;
    issue_date: string | null;
    expiry_date: string | null;
    file_path: string | null;
    /** Tên file sau khi sanitize (lưu trong Storage) */
    file_name: string | null;
    /** Tên file gốc trước khi rename */
    original_file_name: string | null;
    file_size: number | null;
    /** Người upload — map sang profiles.id */
    uploaded_by: string | null;
    created_at: string;
    updated_at: string | null;
    mime_type: string | null;
    site_id: string | null;
    /** Soft delete — không xóa record, chỉ ghi thời điểm */
    deleted_at: string | null;
    deleted_by: string | null;
}

// -------------------------------------------------------
// ALERT
// -------------------------------------------------------

export interface AlertSetting {
    id: string;
    site_id: string | null;
    recipient_email: string;
    days_before: number;
    enabled: boolean | null;
    created_at: string | null;
}

export interface AlertLog {
    id: string;
    asset_id: string | null;
    due_date: string;
    recipient_email: string;
    sent_at: string | null;
}

// -------------------------------------------------------
// KPI SNAPSHOT
// -------------------------------------------------------

export type KpiPeriodType = 'month' | 'year';

export interface KpiSnapshot {
    id: string;
    site_id: string;
    period_type: KpiPeriodType;
    period_value: string;
    total: number;
    ok_count: number;
    due_soon_count: number;
    overdue_count: number;
    declared_count: number;
    not_declared_count: number;
    locked_count: number;
    due_soon_days: number;
    generated_at: string;
}

// -------------------------------------------------------
// PROFILE SITE
// -------------------------------------------------------

export interface ProfileSite {
    id: string;
    profile_id: string | null;
    site_id: string | null;
    is_default: boolean | null;
}

// -------------------------------------------------------
// REFERENCE DOC
// -------------------------------------------------------

export interface ReferenceDoc {
    id: string;
    title: string;
    doc_type: string;
    summary: string | null;
    link_url: string | null;
    file_path: string | null;
    site_id: string | null;
    created_by: string | null;
    created_at: string | null;
    updated_at: string | null;
    file_name: string | null;
    file_size: number | null;
    mime_type: string | null;
}
