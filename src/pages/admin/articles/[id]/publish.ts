import type { APIRoute } from 'astro';
import { getDb } from '../../../../lib/db/client';
import { logError, logInfo } from '../../../../lib/utils/logger';

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { id } = params;
  if (!id) {
    return redirect('/admin/articles?error=Invalid+article+ID', 302);
  }

  const runtimeEnv = locals.runtime?.env;
  const dbService = getDb(runtimeEnv);
  if (!dbService || !runtimeEnv?.DB) {
    return redirect('/admin/articles?error=Database+unavailable', 302);
  }

  const returnTo = request.headers.get('referer') || '/admin/articles';

  try {
    const article = await dbService.getArticleById(id);
    if (!article) {
      return redirect(`/admin/articles?error=Article+not+found`, 302);
    }

    const now = Date.now();

    // 1. Update article status to published in D1
    await runtimeEnv.DB
      .prepare(`
        UPDATE articles
        SET status = 'published',
            published_at = COALESCE(published_at, ?),
            scheduled_at = NULL,
            updated_at = ?
        WHERE id = ?
      `)
      .bind(now, now, id)
      .run();

    // 2. Sync internal link graph
    try {
      const { LinkParserService } = await import('../../../../lib/seo/link-parser');
      const linkParser = new LinkParserService(runtimeEnv.DB);
      await linkParser.syncArticleLinks(id, article.content);
    } catch (e) {
      logError(`Link parser non-blocking error for ${id}`, e);
    }

    // 3. Record Audit Log & Revision
    if (locals.admin) {
      await dbService.logAudit(locals.admin.id, 'publish_article', 'article', id, {
        title: article.title,
        slug: article.slug,
        status: 'published',
      });
    }

    try {
      const { ArticleRevisionService } = await import('../../../../lib/admin/revisions');
      const revService = new ArticleRevisionService(runtimeEnv.DB);
      await revService.createRevision(
        id,
        {
          title: article.title,
          excerpt: article.excerpt || null,
          content: article.content,
          categoryId: article.category_id,
          status: 'published',
        },
        locals.admin?.id || null,
        'publish'
      );
    } catch (e) {
      logError(`Revision non-blocking error for ${id}`, e);
    }

    // 4. Non-blocking IndexNow instant notification
    try {
      const { IndexNowService } = await import('../../../../lib/seo/indexnow');
      const indexNow = new IndexNowService();
      await indexNow.submitArticle(article.slug, {
        db: runtimeEnv.DB,
        adminId: locals.admin?.id,
      });
    } catch (e) {
      logError(`IndexNow non-blocking error for ${article.slug}`, e);
    }

    logInfo(`Article ${id} (${article.slug}) published successfully.`);
    return redirect(`${returnTo.split('?')[0]}?success=Article+published+successfully!+Now+live+on+site.`, 302);
  } catch (error: any) {
    logError(`Failed to publish article ${id}`, error);
    return redirect(`${returnTo.split('?')[0]}?error=${encodeURIComponent(error.message || 'Failed to publish article')}`, 302);
  }
};
