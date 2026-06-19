import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wbqzlxdyjdmbzifhsyil.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function fetchFromSupabase(path: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = decodeURIComponent(paramId);

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid crop ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name_en, name_de, flavor_en, flavor_de, status, photo_url } = body;

    const updateData: any = {};
    if (name_en) updateData.name_en = name_en;
    if (name_de) updateData.name_de = name_de;
    if (flavor_en !== undefined) updateData.flavor_en = flavor_en;
    if (flavor_de !== undefined) updateData.flavor_de = flavor_de;
    if (status) updateData.status = status;
    if (photo_url !== undefined) updateData.photo_url = photo_url;

    await fetchFromSupabase(`/belarro_v4_crop?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });

    const fullCrop = await fetchFromSupabase(
      `/belarro_v4_crop?id=eq.${id}&select=*`
    );

    return NextResponse.json({
      success: true,
      data: fullCrop[0],
    });
  } catch (error) {
    console.error('Crops API PUT error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const id = decodeURIComponent(paramId);

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid crop ID' },
        { status: 400 }
      );
    }

    await fetchFromSupabase(`/belarro_v4_crop?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Crops API DELETE error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
