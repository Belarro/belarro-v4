import { NextRequest, NextResponse } from 'next/server';
import { fetchFromSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, props: Params) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await props.params;

    // Fetch single crop with relations
    const crop = await fetchFromSupabase(`/belarro_v4_crop?id=eq.${id}&select=*`);

    if (!crop || crop.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Crop not found' },
        { status: 404 }
      );
    }

    const cropData = crop[0];

    // Fetch growth procedure
    const procedure = await fetchFromSupabase(
      `/belarro_v4_growth_procedure?crop_id=eq.${id}&select=*`
    );

    // Fetch variants
    const variants = await fetchFromSupabase(
      `/belarro_v4_product_variant?crop_id=eq.${id}&select=*&order=size_grams.asc`
    );

    return NextResponse.json({
      success: true,
      data: {
        ...cropData,
        procedure: procedure[0] || null,
        variants: variants || [],
      },
    });
  } catch (error) {
    console.error('Crops API GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, props: Params) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await props.params;
    const body = await request.json();
    const { name_en, name_de, flavor_en, flavor_de, status, image_url, procedure, variants } = body;

    // Update crop
    const updateData: any = {};
    if (name_en) updateData.name_en = name_en;
    if (name_de) updateData.name_de = name_de;
    if (flavor_en !== undefined) updateData.flavor_en = flavor_en;
    if (flavor_de !== undefined) updateData.flavor_de = flavor_de;
    if (status) updateData.status = status;
    if (image_url !== undefined) updateData.image_url = image_url;
    updateData.updated_at = new Date().toISOString();

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
            updated_at: new Date().toISOString()
          }),
        });
      } else {
        await fetchFromSupabase('/belarro_v4_growth_procedure', {
          method: 'POST',
          body: JSON.stringify({
            id: crypto.randomUUID(),
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
              id: crypto.randomUUID(),
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

export async function DELETE(request: NextRequest, props: Params) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { id } = await props.params;

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
