import type { APIRoute } from 'astro';
import { CANONICAL_PROMPTS } from '../../../../lib/ai/prompts/registry';
import { logError, logInfo } from '../../../../lib/utils/logger';

export const POST: APIRoute = async ({ locals, redirect }) => {
  const runtimeEnv = locals.runtime?.env;
  if (!runtimeEnv || !runtimeEnv.DB) {
    return redirect('/admin/ai/prompts?error=Database+unavailable', 302);
  }

  try {
    const now = Date.now();
    for (const p of CANONICAL_PROMPTS) {
      await runtimeEnv.DB
        .prepare(`
          INSERT INTO prompts (id, name, version, task_type, content, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            version = excluded.version,
            task_type = excluded.task_type,
            content = excluded.content,
            status = excluded.status,
            updated_at = excluded.updated_at
        `)
        .bind(p.id, p.name, p.version, p.task_type, p.content, p.status, p.updatedAt || now, now)
        .run();
    }

    logInfo('Successfully synced all canonical AI prompts to D1');
    return redirect('/admin/ai/prompts?success=All+6+AI+pipeline+prompts+synced+successfully!', 302);
  } catch (error: any) {
    logError('Failed to seed AI prompts', error);
    return redirect(`/admin/ai/prompts?error=${encodeURIComponent(error.message || 'Seeding failed')}`, 302);
  }
};
