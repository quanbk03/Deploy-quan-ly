// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

// Đọc thủ công file .env
const envPath = resolve(process.cwd(), '.env');
const envFile = fs.readFileSync(envPath, 'utf8');

const envVars: Record<string, string> = {};
envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'] || '';
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'] || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Thiếu cấu hình Supabase VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sampleData = [
    {
        asset_code: 'RG1-BCKN-001',
        equipment_name: 'Bình chứa khí nén',
        equipment_type: 'Thiết bị chịu áp',
        location: 'Xưởng 1',
        status: 'in_service',
        site_id: 'RG1',
        description_raw: 'Model: V-15/7\nNhà sản xuất: Công ty CP TB Quang Minh',
        last_inspection_date: '2023-05-19',
        next_due_date: '2024-05-19',
        interval_months: 12,
        is_strict_required: true,
        inspection_agency: 'Công ty TNHH an toàn và Môi trường Green',
        model: 'V-15/7'
    },
    {
        asset_code: 'RG1-BCKN-002',
        equipment_name: 'Bình chứa khí nén',
        equipment_type: 'Thiết bị chịu áp',
        location: 'Xưởng 2',
        status: 'in_service',
        site_id: 'RG1',
        description_raw: 'Model: KC 500/10\nNhà sản xuất: Việt Nam',
        last_inspection_date: '2023-05-19',
        next_due_date: '2024-05-19',
        interval_months: 12,
        is_strict_required: true,
        inspection_agency: 'Công ty TNHH an toàn và Môi trường Green',
        model: 'KC 500/10'
    },
    {
        asset_code: 'RG1-THM-001',
        equipment_name: 'Thang máy thân xe',
        equipment_type: 'Thiết bị nâng hạ',
        location: 'Xưởng 3',
        status: 'in_service',
        site_id: 'RG1',
        description_raw: 'Model: B2000\nTải trọng: 2000kg',
        last_inspection_date: '2023-05-19',
        next_due_date: '2024-05-19',
        interval_months: 12,
        is_strict_required: true,
        inspection_agency: 'Công ty TNHH an toàn và Môi trường Green',
        model: 'B2000'
    },
    {
        asset_code: 'RG1-XNH-001',
        equipment_name: 'Xe nâng hàng',
        equipment_type: 'Thiết bị nâng hạ',
        location: 'Kho linh kiện',
        status: 'in_service',
        site_id: 'RG1',
        description_raw: 'Model: TCM 25\nTải trọng: 2500kg\nNhà sản xuất: TCM',
        last_inspection_date: '2023-05-19',
        next_due_date: '2024-05-19',
        interval_months: 12,
        is_strict_required: true,
        inspection_agency: 'Công ty TNHH an toàn và Môi trường Green',
        model: 'TCM 25'
    },
    {
        asset_code: 'RG1-XNH-002',
        equipment_name: 'Xe nâng hàng',
        equipment_type: 'Thiết bị nâng hạ',
        location: 'Kho thành phẩm',
        status: 'in_service',
        site_id: 'RG1',
        description_raw: 'Model: BYD 25\nTải trọng: 2500kg\nNhà sản xuất: BYD',
        last_inspection_date: '2023-05-19',
        next_due_date: '2024-05-19',
        interval_months: 12,
        is_strict_required: true,
        inspection_agency: 'Công ty TNHH an toàn và Môi trường Green',
        model: 'BYD 25'
    },
    {
        asset_code: 'RG1-HTO-001',
        equipment_name: 'Hệ thống đường ống dẫn khí nén',
        equipment_type: 'Thiết bị chịu áp',
        location: 'Block C',
        status: 'in_service',
        site_id: 'RG1',
        description_raw: 'Áp suất thiết kế: 8 Bar\nMôi chất làm việc: Không khí',
        last_inspection_date: '2023-05-19',
        next_due_date: '2024-05-19',
        interval_months: 12,
        is_strict_required: true,
        inspection_agency: 'Công ty TNHH an toàn và Môi trường Green',
        model: 'N/A'
    }
];

async function seed() {
    console.log('Đang đăng nhập...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'quan1412@gmail.com',
        password: '123456'
    });

    if (authError) {
        console.error('Đăng nhập thất bại:', authError.message);
        return;
    }

    console.log('Đăng nhập thành công! Bắt đầu đẩy dữ liệu nền (Seed Data)...');

    for (const asset of sampleData) {
        try {
            // 1. Kiểm tra tồn tại
            const { data: existing } = await supabase
                .from('assets')
                .select('id')
                .eq('asset_code', asset.asset_code)
                .single();

            let assetId;

            if (existing) {
                console.log(`- Thiết bị ${asset.asset_code} đã tồn tại, đang cập nhật...`);
                assetId = existing.id;
                const { error: updateError } = await supabase
                    .from('assets')
                    .update(asset)
                    .eq('id', assetId);
                if (updateError) throw updateError;
            } else {
                console.log(`- Đang tạo mới thiết bị ${asset.asset_code}...`);
                const { data: newAsset, error: createError } = await supabase
                    .from('assets')
                    .insert([asset])
                    .select()
                    .single();
                if (createError) throw createError;
                assetId = newAsset.id;
            }

            // 2. Tạo sự kiện KĐ (AssetEvent)
            const eventPayload = {
                asset_id: assetId,
                event_type: 'periodic',
                status: 'done',
                scheduled_date: asset.last_inspection_date,
                completed_date: asset.last_inspection_date,
                interval_months: asset.interval_months,
                notes: 'Chèn tự động từ kịch bản Seed Data',
                agency: asset.inspection_agency,
            };

            await supabase.from('events').insert([eventPayload]);

        } catch (error) {
            console.error(`Lỗi khi xử lý ${asset.asset_code}:`, error.message);
        }
    }

    console.log('Hoàn thành đẩy dữ liệu nền!');
}

seed();
