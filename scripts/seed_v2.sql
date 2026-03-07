-- 1. Chèn Dữ liệu Master Data
INSERT INTO public.sites (id, name) VALUES ('RG1', 'Nhà máy RG1') ON CONFLICT (id) DO NOTHING;

INSERT INTO public.equipment_categories (id, code, label_short, label_full, sort_order) VALUES
('CAT-001', 'BCKN', 'Bình khí', 'Bình chứa khí nén', 10),
('CAT-002', 'THM', 'Thang máy', 'Thang máy & Tời nâng', 20),
('CAT-003', 'XNH', 'Xe nâng', 'Xe nâng hàng', 30),
('CAT-004', 'HTO', 'Đường ống', 'Hệ thống đường ống', 40)
ON CONFLICT (id) DO NOTHING;

-- 2. Chèn 6 thiết bị mẫu dựa trên Table Mới V2
INSERT INTO public.assets (
    id, asset_code, equipment_name, equipment_category, equipment_type, location, status, site_id, description_raw,
    last_inspection_date, next_due_date, interval_months, is_strict_required, inspection_agency, model, manufacturer
) VALUES
(gen_random_uuid(), 'RG1-BCKN-001', 'Bình chứa khí nén', 'CAT-001', 'Thiết bị chịu áp', 'Xưởng 1', 'in_service', 'RG1', 'Model: V-15/7\nNhà sản xuất: Công ty CP TB Quang Minh', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'V-15/7', 'Công ty CP TB Quang Minh'),
(gen_random_uuid(), 'RG1-BCKN-002', 'Bình chứa khí nén', 'CAT-001', 'Thiết bị chịu áp', 'Xưởng 2', 'in_service', 'RG1', 'Model: KC 500/10\nNhà sản xuất: Việt Nam', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'KC 500/10', 'Việt Nam'),
(gen_random_uuid(), 'RG1-THM-001', 'Thang máy thân xe', 'CAT-002', 'Thiết bị nâng hạ', 'Xưởng 3', 'in_service', 'RG1', 'Model: B2000\nTải trọng: 2000kg', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'B2000', 'N/A'),
(gen_random_uuid(), 'RG1-XNH-001', 'Xe nâng hàng', 'CAT-003', 'Thiết bị nâng hạ', 'Kho linh kiện', 'in_service', 'RG1', 'Model: TCM 25\nTải trọng: 2500kg\nNhà sản xuất: TCM', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'TCM 25', 'TCM'),
(gen_random_uuid(), 'RG1-XNH-002', 'Xe nâng hàng', 'CAT-003', 'Thiết bị nâng hạ', 'Kho thành phẩm', 'in_service', 'RG1', 'Model: BYD 25\nTải trọng: 2500kg\nNhà sản xuất: BYD', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'BYD 25', 'BYD'),
(gen_random_uuid(), 'RG1-HTO-001', 'Hệ thống đường ống dẫn khí nén', 'CAT-004', 'Thiết bị chịu áp', 'Block C', 'in_service', 'RG1', 'Áp suất thiết kế: 8 Bar\nMôi chất làm việc: Không khí', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'N/A', 'N/A')
ON CONFLICT (asset_code) DO NOTHING;

-- 3. Chèn dữ liệu sự kiện kiểm định (V2 đổi cột data)
INSERT INTO public.asset_events (id, asset_id, event_type, status, planned_date, performed_date, interval_months, notes, agency, result)
SELECT 
    gen_random_uuid(),
    id,
    'periodic',
    'verified',
    last_inspection_date,
    last_inspection_date,
    interval_months,
    'Chèn tự động từ kịch bản Seed Data V2',
    inspection_agency,
    'pass'
FROM public.assets
WHERE asset_code IN ('RG1-BCKN-001','RG1-BCKN-002','RG1-THM-001','RG1-XNH-001','RG1-XNH-002','RG1-HTO-001')
AND NOT EXISTS (
    SELECT 1 FROM public.asset_events e WHERE e.asset_id = public.assets.id AND e.event_type = 'periodic'
);
