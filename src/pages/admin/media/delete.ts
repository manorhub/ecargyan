import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/client';
import { getStorage } from '../../../lib/cloudflare/r2';

export const POST: APIRoute = async ({ request, locals }) => {
  const runtimeEnv = locals.runtime?.env;
  const dbService = getDb(runtimeEnv);
  const storageService = getStorage(runtimeEnv);

  if (!dbService || !storageService) {
    return new Response('Services unavailable', { status: 503 });
  }

  const formData = await request.formData();
  const id = formData.get('id') as string;

  if (id) {
    const deletedRecord = await dbService.deleteMedia(id);
    if (deletedRecord) {
      try {
        await storageService.delete(deletedRecord.storage_key);
      } catch {
        // Continue even if R2 key was already purged
      }

      if (locals.admin) {
        await dbService.logAudit(locals.admin.id, 'delete_media', 'media', id, { storageKey: deletedRecord.storage_key });
      }
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/media' },
  });
};
