import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/client';
import { getStorage } from '../../../lib/cloudflare/r2';
import { validateMediaUpload } from '../../../lib/utils/validation';

export const POST: APIRoute = async ({ request, locals }) => {
  const runtimeEnv = locals.runtime?.env;
  const dbService = getDb(runtimeEnv);
  const storageService = getStorage(runtimeEnv);

  if (!dbService || !storageService) {
    return new Response('Services unavailable', { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const altText = (formData.get('alt_text') as string || '').trim();
    const caption = (formData.get('caption') as string || '').trim();

    if (!file || file.size === 0) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin/media?error=No+file+selected' },
      });
    }

    const validation = validateMediaUpload(file.type, file.size);
    if (!validation.valid) {
      const msg = encodeURIComponent(Object.values(validation.errors)[0] || 'Upload error');
      return new Response(null, {
        status: 302,
        headers: { Location: `/admin/media?error=${msg}` },
      });
    }

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const mediaId = `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const storageKey = `media/${year}/${month}/${mediaId}.${extension}`;

    const buffer = await file.arrayBuffer();
    await storageService.upload(storageKey, buffer, {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000, immutable',
    });

    await dbService.createMedia({
      id: mediaId,
      storage_key: storageKey,
      filename: file.name,
      mime_type: file.type,
      size: file.size,
      alt_text: altText || null,
      caption: caption || null,
    });

    if (locals.admin) {
      await dbService.logAudit(locals.admin.id, 'upload_media', 'media', mediaId, { filename: file.name, storageKey });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/media?success=File+uploaded+successfully' },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/media?error=Upload+failed' },
    });
  }
};
