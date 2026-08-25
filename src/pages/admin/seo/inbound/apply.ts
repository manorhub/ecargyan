import type { APIRoute } from 'astro';
import { InboundLinkEngine } from '../../../../lib/seo/inbound';
import { logError } from '../../../../lib/utils/logger';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const runtimeEnv = locals.runtime?.env;
  if (!runtimeEnv || !runtimeEnv.DB) {
    return redirect('/admin/seo?error=Database+unavailable', 302);
  }

  const adminId = locals.admin?.id || 'admin';
  const returnTo = request.headers.get('referer') || '/admin/seo/orphan-prevention';

  try {
    const formData = await request.formData();
    const sourceArticleId = formData.get('sourceArticleId')?.toString();
    const targetArticleId = formData.get('targetArticleId')?.toString();
    const originalSentence = formData.get('originalSentence')?.toString();
    const replacementSentence = formData.get('replacementSentence')?.toString();

    if (!sourceArticleId || !targetArticleId || !originalSentence || !replacementSentence) {
      return redirect(`${returnTo}?error=Missing+required+link+parameters`, 302);
    }

    const engine = new InboundLinkEngine(runtimeEnv.DB);
    const result = await engine.applyInboundLink(
      sourceArticleId,
      targetArticleId,
      originalSentence,
      replacementSentence,
      adminId
    );

    if (!result.success) {
      return redirect(`${returnTo}?error=${encodeURIComponent(result.error || 'Failed to apply inbound link')}`, 302);
    }

    return redirect(`${returnTo}?success=Inbound+link+successfully+injected+into+source+article!`, 302);
  } catch (error: any) {
    logError('Failed to apply inbound link', error);
    return redirect(`${returnTo}?error=${encodeURIComponent(error.message || 'Injection error')}`, 302);
  }
};
