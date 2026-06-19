import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wbqzlxdyjdmbzifhsyil.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(request.url);
    const cropId = searchParams.get('id');

    if (cropId) {
      // Fetch single crop with relations
      const crop = await fetchFromSupabase(
        `/belarro_v4_crop?id=eq.${cropId}&select=*`
      );

      if (!crop || crop.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Crop not found' },
          { status: 404 }
        );
      }

      const cropData = crop[0];

      // Fetch growth procedure
      const procedure = await fetchFromSupabase(
        `/belarro_v4_growth_procedure?crop_id=eq.${cropId}&select=*`
      );

      // Fetch variants
      const variants = await fetchFromSupabase(
        `/belarro_v4_product_variant?crop_id=eq.${cropId}&select=*&order=size_grams.asc`
      );

      return NextResponse.json({
        success: true,
        data: {
          ...cropData,
          procedure: procedure[0] || null,
          variants: variants || [],
        },
      });
    }

    // Fetch all crops
    const crops = await fetchFromSupabase(
      `/belarro_v4_crop?deleted_at=is.null&select=*&order=created_at.desc`
    );

    return NextResponse.json({
      success: true,
      data: crops || [],
    });
  } catch (error) {
    console.error('Crops API GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const { name_en, name_de, flavor_en, flavor_de, status, image_url, procedure, variants } = body;

    if (!name_en || !name_de) {
      return NextResponse.json(
        { success: false, error: 'name_en and name_de are required' },
        { status: 400 }
      );
    }

    // Generate UUIDs for all records
    const cropId = crypto.randomUUID();
    const procedureId = procedure ? crypto.randomUUID() : null;
    const variantIds = variants ? variants.map(() => crypto.randomUUID()) : [];

    // Create crop
    const crops = await fetchFromSupabase('/belarro_v4_crop', {
      method: 'POST',
      body: JSON.stringify({
        id: cropId,
        name_en,
        name_de,
        flavor_en: flavor_en || null,
        flavor_de: flavor_de || null,
        status: status || 'active',
        image_url: image_url || null,
      }),
    });

    const crop = crops[0];

    // Create growth procedure if provided
    if (procedure) {
      await fetchFromSupabase('/belarro_v4_growth_procedure', {
        method: 'POST',
        body: JSON.stringify({
          id: procedureId,
          crop_id: cropId,
          soak_enabled: procedure.soak_enabled || false,
          soak_hours: procedure.soak_hours || null,
          cover_soil_enabled: procedure.cover_soil_enabled || false,
          stack_enabled: procedure.stack_enabled || false,
          stack_days: procedure.stack_days || null,
          // New separate fields
          blackout_enabled: procedure.blackout_enabled || false,
          blackout_days: procedure.blackout_days || null,
          humidity_dome_days: procedure.humidity_dome_days || null,
          lights_enabled: procedure.lights_enabled !== false,
          lights_days: procedure.lights_days || null,
          // Legacy columns mapping
          growth_env_type: procedure.growth_env_type || 'light',
          growth_env_days: procedure.lights_enabled ? (procedure.lights_days || 0) : (procedure.blackout_days || 0),
          humidity_dome_enabled: procedure.humidity_dome_enabled || false,
        }),
      });
    }

    // Create variants if provided
    if (variants && Array.isArray(variants) && variants.length > 0) {
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        if (variant.size_name && variant.size_grams) {
          await fetchFromSupabase('/belarro_v4_product_variant', {
            method: 'POST',
            body: JSON.stringify({
              id: variantIds[i],
              crop_id: cropId,
              size_name: variant.size_name,
              size_grams: variant.size_grams,
              price_eur: variant.price_eur || null,
              is_internal: variant.is_internal || false,
            }),
          });
        }
      }
    }

    // Fetch full crop with relations
    const fullCrop = await fetchFromSupabase(
      `/belarro_v4_crop?id=eq.${cropId}&select=*`
    );

    const procedure_data = await fetchFromSupabase(
      `/belarro_v4_growth_procedure?crop_id=eq.${cropId}&select=*`
    );

    const variants_data = await fetchFromSupabase(
      `/belarro_v4_product_variant?crop_id=eq.${cropId}&select=*&order=size_grams.asc`
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          ...fullCrop[0],
          procedure: procedure_data[0] || null,
          variants: variants_data || [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Crops API POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const { id, name_en, name_de, flavor_en, flavor_de, status, image_url, procedure, variants } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    // Update crop
    const updateData: any = {};
    if (name_en) updateData.name_en = name_en;
    if (name_de) updateData.name_de = name_de;
    if (flavor_en !== undefined) updateData.flavor_en = flavor_en;
    if (flavor_de !== undefined) updateData.flavor_de = flavor_de;
    if (status) updateData.status = status;
    if (image_url !== undefined) updateData.image_url = image_url;

    await fetchFromSupabase(`/belarro_v4_crop?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });

    // Update growth procedure
    if (procedure) {
      const existing = await fetchFromSupabase(
        `/belarro_v4_growth_procedure?crop_id=eq.${id}&select=id`
      );

      if (existing && existing.length > 0) {
        await fetchFromSupabase(`/belarro_v4_growth_procedure?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            soak_enabled: procedure.soak_enabled || false,
            soak_hours: procedure.soak_hours || null,
            cover_soil_enabled: procedure.cover_soil_enabled || false,
            stack_enabled: procedure.stack_enabled || false,
            stack_days: procedure.stack_days || null,
            // New separate fields
            blackout_enabled: procedure.blackout_enabled || false,
            blackout_days: procedure.blackout_days || null,
            humidity_dome_days: procedure.humidity_dome_days || null,
            lights_enabled: procedure.lights_enabled !== false,
            lights_days: procedure.lights_days || null,
            // Legacy columns mapping
            growth_env_type: procedure.growth_env_type || 'light',
            growth_env_days: procedure.lights_enabled ? (procedure.lights_days || 0) : (procedure.blackout_days || 0),
            humidity_dome_enabled: procedure.humidity_dome_enabled || false,
          }),
        });
      } else {
        await fetchFromSupabase('/belarro_v4_growth_procedure', {
          method: 'POST',
          body: JSON.stringify({
            crop_id: id,
            soak_enabled: procedure.soak_enabled || false,
            soak_hours: procedure.soak_hours || null,
            cover_soil_enabled: procedure.cover_soil_enabled || false,
            stack_enabled: procedure.stack_enabled || false,
            stack_days: procedure.stack_days || null,
            // New separate fields
            blackout_enabled: procedure.blackout_enabled || false,
            blackout_days: procedure.blackout_days || null,
            humidity_dome_days: procedure.humidity_dome_days || null,
            lights_enabled: procedure.lights_enabled !== false,
            lights_days: procedure.lights_days || null,
            // Legacy columns mapping
            growth_env_type: procedure.growth_env_type || 'light',
            growth_env_days: procedure.lights_enabled ? (procedure.lights_days || 0) : (procedure.blackout_days || 0),
            humidity_dome_enabled: procedure.humidity_dome_enabled || false,
          }),
        });
      }
    }

    // Update variants (delete old, create new)
    if (variants && Array.isArray(variants)) {
      await fetchFromSupabase(`/belarro_v4_product_variant?crop_id=eq.${id}`, {
        method: 'DELETE',
      });

      for (const variant of variants) {
        if (variant.size_name && variant.size_grams) {
          await fetchFromSupabase('/belarro_v4_product_variant', {
            method: 'POST',
            body: JSON.stringify({
              crop_id: id,
              size_name: variant.size_name,
              size_grams: variant.size_grams,
              price_eur: variant.price_eur || null,
              is_internal: variant.is_internal || false,
            }),
          });
        }
      }
    }

    // Fetch updated crop
    const fullCrop = await fetchFromSupabase(
      `/belarro_v4_crop?id=eq.${id}&select=*`
    );

    const procedure_data = await fetchFromSupabase(
      `/belarro_v4_growth_procedure?crop_id=eq.${id}&select=*`
    );

    const variants_data = await fetchFromSupabase(
      `/belarro_v4_product_variant?crop_id=eq.${id}&select=*&order=size_grams.asc`
    );

    return NextResponse.json({
      success: true,
      data: {
        ...fullCrop[0],
        procedure: procedure_data[0] || null,
        variants: variants_data || [],
      },
    });
  } catch (error) {
    console.error('Crops API PUT error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    // Soft delete
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
