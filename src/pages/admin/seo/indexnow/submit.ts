import type { APIRoute } from 'astro';
import { IndexNowService } from '../../../../lib/seo/indexnow';
import { logError } from '../../../../lib/utils/logger';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const runtimeEnv = locals.runtime?.env;
  if (!runtimeEnv || !runtimeEnv.DB) {
    return redirect('/admin/seo/indexnow?error=Database+unavailable', 302);
  }

  const adminId = locals.admin?.id || 'admin';
  const indexNow = new IndexNowService();

  try {
    const formData = await request.formData();
    const action = formData.get('action')?.toString();
    const customUrl = formData.get('customUrl')?.toString().trim();

    if (action === 'submit_all') {
      const result = await indexNow.submitAllPublishedArticles(runtimeEnv.DB, { adminId });
      if (result.success) {
        return redirect(
          `/admin/seo/indexnow?success=${encodeURIComponent(`Successfully submitted ${result.submittedCount} URLs to IndexNow! (${result.message})`)}`,
          302
        );
      } else {
        return redirect(
          `/admin/seo/indexnow?error=${encodeURIComponent(result.message || 'Submission failed')}`,
          302
        );
      }
    }

    if (customUrl) {
      const result = await indexNow.submitUrls(customUrl, { db: runtimeEnv.DB, adminId });
      if (result.success) {
        return redirect(
          `/admin/seo/indexnow?success=${encodeURIComponent(`Submitted URL to IndexNow: ${result.message}`)}`,
          302
        );
      } else {
        return redirect(
          `/admin/seo/indexnow?error=${encodeURIComponent(result.message || 'Submission failed')}`,
          302
        );
      }
    }

    return redirect('/admin/seo/indexnow?error=No+action+or+URL+provided', 302);
  } catch (error: any) {
    logError('IndexNow admin submission error', error);
    return redirect(
      `/admin/seo/indexnow?error=${encodeURIComponent(error.message || 'Submission error')}`,
      302
    );
  }
};
