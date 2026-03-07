-- Xóa script nếu cần (Optional)
-- Xóa bảng cũ hoặc dữ liệu cũ để tránh trùng lặp nếu chạy lại
-- DELETE FROM public.events;
-- DELETE FROM public.assets;

-- Chèn 6 thiết bị mẫu theo bảng Excel
INSERT INTO public.assets (
    id, asset_code, equipment_name, equipment_type, location, status, site_id, description_raw,
    last_inspection_date, next_due_date, interval_months, is_strict_required, inspection_agency, model
) VALUES
(gen_random_uuid(), 'RG1-BCKN-001', 'Bình chứa khí nén', 'Thiết bị chịu áp', 'Xưởng 1', 'in_service', 'RG1', 'Model: V-15/7\nNhà sản xuất: Công ty CP TB Quang Minh', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'V-15/7'),
(gen_random_uuid(), 'RG1-BCKN-002', 'Bình chứa khí nén', 'Thiết bị chịu áp', 'Xưởng 2', 'in_service', 'RG1', 'Model: KC 500/10\nNhà sản xuất: Việt Nam', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'KC 500/10'),
(gen_random_uuid(), 'RG1-THM-001', 'Thang máy thân xe', 'Thiết bị nâng hạ', 'Xưởng 3', 'in_service', 'RG1', 'Model: B2000\nTải trọng: 2000kg', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'B2000'),
(gen_random_uuid(), 'RG1-XNH-001', 'Xe nâng hàng', 'Thiết bị nâng hạ', 'Kho linh kiện', 'in_service', 'RG1', 'Model: TCM 25\nTải trọng: 2500kg\nNhà sản xuất: TCM', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'TCM 25'),
(gen_random_uuid(), 'RG1-XNH-002', 'Xe nâng hàng', 'Thiết bị nâng hạ', 'Kho thành phẩm', 'in_service', 'RG1', 'Model: BYD 25\nTải trọng: 2500kg\nNhà sản xuất: BYD', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'BYD 25'),
(gen_random_uuid(), 'RG1-HTO-001', 'Hệ thống đường ống dẫn khí nén', 'Thiết bị chịu áp', 'Block C', 'in_service', 'RG1', 'Áp suất thiết kế: 8 Bar\nMôi chất làm việc: Không khí', '2023-05-19', '2024-05-19', 12, true, 'Công ty TNHH an toàn và Môi trường Green', 'N/A')
ON CONFLICT (asset_code) DO NOTHING;

-- Chèn dữ liệu sự kiện kiểm định lịch sử cho các thiết bị trên
INSERT INTO public.asset_events (id, asset_id, event_type, status, scheduled_date, completed_date, interval_months, notes, agency)
SELECT 
    gen_random_uuid(),
    id,
    'periodic',
    'done',
    last_inspection_date,
    last_inspection_date,
    interval_months,
    'Chèn tự động từ kịch bản Seed Data',
    inspection_agency
FROM public.assets
WHERE asset_code IN ('RG1-BCKN-001','RG1-BCKN-002','RG1-THM-001','RG1-XNH-001','RG1-XNH-002','RG1-HTO-001')
AND NOT EXISTS (
    SELECT 1 FROM public.asset_events e WHERE e.asset_id = public.assets.id AND e.event_type = 'periodic'
);
