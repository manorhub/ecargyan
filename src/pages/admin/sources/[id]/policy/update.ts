import type { APIRoute } from 'astro';
import { getDb } from '../../../../../lib/db/client';
import { logInfo, logError } from '../../../../../lib/utils/logger';
import type { PolicyStatus, LicenseType, SourceTier } from '../../../../../lib/sources/types';

export const POST: APIRoute = async ({ request, params, locals, redirect }) => {
  const { id } = params;
  if (!id) {
    return redirect('/admin/sources?error=Missing+source+ID', 302);
  }

  const adminId = locals.admin?.id || null;

  const runtimeEnv = locals.runtime?.env;
  const dbService = getDb(runtimeEnv);
  if (!dbService) {
    return redirect(`/admin/sources/${id}/policy?error=Database+unavailable`, 302);
  }

  try {
    const formData = await request.formData();

    const reviewStatus = (formData.get('reviewStatus') as PolicyStatus) || 'UNKNOWN';
    const sourceTier = (formData.get('sourceTier') as SourceTier) || 'SECONDARY';
    const licenseType = (formData.get('licenseType') as LicenseType) || 'UNKNOWN';
    const sourceTermsUrl = (formData.get('sourceTermsUrl') as string)?.trim() || null;

    const researchAllowed = formData.get('researchAllowed') === '1';
    const commercialUseAllowed = formData.get('commercialUseAllowed') === '1';
    const aiProcessingAllowed = formData.get('aiProcessingAllowed') === '1';
    const fullContentStorageAllowed = formData.get('fullContentStorageAllowed') === '1';
    const metadataStorageAllowed = formData.get('metadataStorageAllowed') === '1';

    const attributionRequired = formData.get('attributionRequired') === '1';
    const attributionText = (formData.get('attributionText') as string)?.trim() || null;
    const publicLinkRequired = formData.get('publicLinkRequired') === '1';
    const publicSourceLink = (formData.get('publicSourceLink') as string)?.trim() || null;

    const nextReviewDateStr = (formData.get('nextReviewAt') as string)?.trim();
    let nextReviewAt: number | null = null;
    if (nextReviewDateStr) {
      nextReviewAt = new Date(nextReviewDateStr).getTime();
    }

    const policyNotes = (formData.get('policyNotes') as string)?.trim() || null;

    // Save policy
    await dbService.saveSourcePolicy(
      id,
      {
        researchAllowed,
        commercialUseAllowed,
        aiProcessingAllowed,
        fullContentStorageAllowed,
        metadataStorageAllowed,
        attributionRequired,
        attributionText,
        publicLinkRequired,
        publicSourceLink,
        sourceTermsUrl,
        licenseType,
        sourceTier,
        policyNotes,
        reviewStatus,
        nextReviewAt,
      },
      adminId
    );

    // Audit Logging
    try {
      let auditAction = 'SOURCE_POLICY_UPDATED';
      if (reviewStatus === 'ALLOWED') auditAction = 'SOURCE_POLICY_APPROVED';
      else if (reviewStatus === 'RESTRICTED') auditAction = 'SOURCE_POLICY_RESTRICTED';
      else if (reviewStatus === 'BLOCKED') auditAction = 'SOURCE_POLICY_BLOCKED';
      else if (reviewStatus === 'REVIEW_REQUIRED') auditAction = 'SOURCE_POLICY_REVIEW_REQUIRED';

      await runtimeEnv?.DB?.prepare(`
        INSERT INTO audit_logs (id, admin_id, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, 'source_policy', ?, ?, ?)
      `)
        .bind(
          `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          adminId,
          auditAction,
          id,
          JSON.stringify({
            reviewStatus,
            sourceTier,
            licenseType,
            aiProcessingAllowed,
            commercialUseAllowed,
            researchAllowed,
            nextReviewAt,
          }),
          Date.now()
        )
        .run();
    } catch (auditErr) {
      logError('Failed to record audit log for source policy', auditErr);
    }

    logInfo(`Admin ${adminId || 'anon'} updated policy for source ${id} to ${reviewStatus}`);
    return redirect(`/admin/sources/${id}/policy?success=Source+usage+policy+updated+successfully`, 302);
  } catch (error: any) {
    logError(`Error saving source policy for ${id}`, error);
    return redirect(`/admin/sources/${id}/policy?error=${encodeURIComponent(error.message || 'Failed to update policy')}`, 302);
  }
};
