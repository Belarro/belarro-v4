import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wbqzlxdyjdmbzifhsyil.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const cropId = formData.get('cropId') as string;

    if (!file || !cropId) {
      return Response.json(
        { success: false, error: 'File and cropId are required' },
        { status: 400 }
      );
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cropId)) {
      return Response.json(
        { success: false, error: 'Invalid crop ID' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return Response.json(
        { success: false, error: 'Only image files allowed' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeFileName = `crop-${cropId}-${timestamp}.${ext}`;
    const bucket = 'crop-photos';

    const bytes = await file.arrayBuffer();
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(safeFileName, bytes, {
        contentType: file.type,
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return Response.json(
        { success: false, error: 'Failed to upload photo' },
        { status: 500 }
      );
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(safeFileName);

    return Response.json({
      success: true,
      photo_url: publicData.publicUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
