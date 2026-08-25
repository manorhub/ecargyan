/**
 * Central Source Policy & Whitelist Evaluation Engine
 * Strictly enforces source usage terms before Ingestion, AI Processing, and Publishing.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  SourcePolicyRecord,
  SourcePolicyDecision,
  PolicyStatus,
  LicenseType,
  SourceTier,
} from './types';
import { logInfo, logWarn, logError } from '../utils/logger';

export class SourcePolicyService {
  constructor(private readonly db: D1Database) {}

  /**
   * Fetch the explicit policy for a source.
   * If no explicit policy exists, returns an UNKNOWN policy record (never defaults to ALLOWED).
   */
  async getPolicy(sourceId: string): Promise<SourcePolicyRecord> {
    try {
      const policy = await this.db
        .prepare(`
          SELECT 
            sp.*,
            s.name as source_name,
            s.base_url as source_url,
            s.source_type,
            adm.email as reviewed_by_email
          FROM source_policies sp
          JOIN sources s ON sp.source_id = s.id
          LEFT JOIN admins adm ON sp.reviewed_by = adm.id
          WHERE sp.source_id = ?
          LIMIT 1
        `)
        .bind(sourceId)
        .first<SourcePolicyRecord>();

      if (policy) {
        // Evaluate policy expiration
        if (policy.next_review_at && policy.next_review_at < Date.now()) {
          policy.review_status = 'REVIEW_REQUIRED';
        }
        return policy;
      }

      // Fetch base source details for default unreviewed record
      const source = await this.db
        .prepare('SELECT name, base_url, source_type, status FROM sources WHERE id = ? LIMIT 1')
        .bind(sourceId)
        .first<{ name: string; base_url: string; source_type: any; status: any }>();

      const now = Date.now();
      return {
        id: `pol_default_${sourceId}`,
        source_id: sourceId,
        source_status: source?.status || 'active',
        research_allowed: 0,
        commercial_use_allowed: 0,
        ai_processing_allowed: 0,
        full_content_storage_allowed: 0,
        metadata_storage_allowed: 1,
        attribution_required: 1,
        attribution_text: source?.name ? `Source: ${source.name}` : null,
        public_link_required: 1,
        public_source_link: source?.base_url || null,
        source_terms_url: null,
        license_type: 'UNKNOWN',
        source_tier: 'SECONDARY',
        policy_notes: 'Unreviewed source. Explicit policy review required.',
        review_status: 'UNKNOWN',
        reviewed_by: null,
        last_reviewed_at: null,
        next_review_at: null,
        created_at: now,
        updated_at: now,
        source_name: source?.name,
        source_url: source?.base_url,
        source_type: source?.source_type,
        reviewed_by_email: null,
      };
    } catch (error) {
      logError(`Failed to fetch policy for source ${sourceId}`, error);
      throw error;
    }
  }

  /**
   * Save or update an explicit source policy.
   */
  async savePolicy(
    sourceId: string,
    data: {
      researchAllowed: boolean;
      commercialUseAllowed: boolean;
      aiProcessingAllowed: boolean;
      fullContentStorageAllowed: boolean;
      metadataStorageAllowed: boolean;
      attributionRequired: boolean;
      attributionText: string | null;
      publicLinkRequired: boolean;
      publicSourceLink: string | null;
      sourceTermsUrl: string | null;
      licenseType: LicenseType;
      sourceTier: SourceTier;
      policyNotes: string | null;
      reviewStatus: PolicyStatus;
      nextReviewAt: number | null;
    },
    adminId: string | null
  ): Promise<void> {
    const now = Date.now();
    const id = `pol_${sourceId}_${now}`;

    await this.db
      .prepare(`
        INSERT INTO source_policies (
          id, source_id, source_status, research_allowed, commercial_use_allowed,
          ai_processing_allowed, full_content_storage_allowed, metadata_storage_allowed,
          attribution_required, attribution_text, public_link_required, public_source_link,
          source_terms_url, license_type, source_tier, policy_notes, review_status,
          reviewed_by, last_reviewed_at, next_review_at, created_at, updated_at
        ) VALUES (
          ?, ?, 'active', ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
        ON CONFLICT(source_id) DO UPDATE SET
          research_allowed = excluded.research_allowed,
          commercial_use_allowed = excluded.commercial_use_allowed,
          ai_processing_allowed = excluded.ai_processing_allowed,
          full_content_storage_allowed = excluded.full_content_storage_allowed,
          metadata_storage_allowed = excluded.metadata_storage_allowed,
          attribution_required = excluded.attribution_required,
          attribution_text = excluded.attribution_text,
          public_link_required = excluded.public_link_required,
          public_source_link = excluded.public_source_link,
          source_terms_url = excluded.source_terms_url,
          license_type = excluded.license_type,
          source_tier = excluded.source_tier,
          policy_notes = excluded.policy_notes,
          review_status = excluded.review_status,
          reviewed_by = excluded.reviewed_by,
          last_reviewed_at = excluded.last_reviewed_at,
          next_review_at = excluded.next_review_at,
          updated_at = excluded.updated_at
      `)
      .bind(
        id,
        sourceId,
        data.researchAllowed ? 1 : 0,
        data.commercialUseAllowed ? 1 : 0,
        data.aiProcessingAllowed ? 1 : 0,
        data.fullContentStorageAllowed ? 1 : 0,
        data.metadataStorageAllowed ? 1 : 0,
        data.attributionRequired ? 1 : 0,
        data.attributionText,
        data.publicLinkRequired ? 1 : 0,
        data.publicSourceLink,
        data.sourceTermsUrl,
        data.licenseType,
        data.sourceTier,
        data.policyNotes,
        data.reviewStatus,
        adminId,
        now,
        data.nextReviewAt,
        now,
        now
      )
      .run();

    logInfo(`Source policy updated for source ${sourceId}: ${data.reviewStatus} (Reviewed by: ${adminId || 'system'})`);
  }

  /**
   * INGESTION GATE: Check if source is allowed for automated ingestion.
   */
  async canIngest(sourceId: string): Promise<SourcePolicyDecision> {
    const policy = await this.getPolicy(sourceId);

    if (policy.review_status === 'BLOCKED') {
      return {
        allowed: false,
        action: 'block',
        reason: `Source is marked as BLOCKED by editorial policy. Ingestion rejected.`,
        policy,
      };
    }

    if (policy.review_status === 'UNKNOWN') {
      return {
        allowed: false,
        action: 'review',
        reason: `Source policy is UNKNOWN. Explicit admin review required before automated ingestion.`,
        policy,
      };
    }

    if (policy.review_status === 'REVIEW_REQUIRED') {
      return {
        allowed: false,
        action: 'review',
        reason: `Source policy review has expired or is flagged for review.`,
        policy,
      };
    }

    if (!policy.metadata_storage_allowed) {
      return {
        allowed: false,
        action: 'block',
        reason: `Source policy prohibits metadata storage.`,
        policy,
      };
    }

    return {
      allowed: true,
      action: 'allow',
      reason: `Source policy allows metadata ingestion (${policy.review_status}).`,
      policy,
    };
  }

  /**
   * AI GATE: Check if source material can be included in DeepSeek prompts.
   */
  async canProcessAi(sourceId: string): Promise<SourcePolicyDecision> {
    const policy = await this.getPolicy(sourceId);

    if (policy.review_status === 'BLOCKED') {
      return {
        allowed: false,
        action: 'block',
        reason: `Source is BLOCKED. Material cannot be sent to DeepSeek AI.`,
        policy,
      };
    }

    if (policy.review_status !== 'ALLOWED') {
      return {
        allowed: false,
        action: 'review',
        reason: `Source review status is '${policy.review_status}'. Only explicitly ALLOWED sources can be processed by AI.`,
        policy,
      };
    }

    if (!policy.ai_processing_allowed || !policy.research_allowed) {
      return {
        allowed: false,
        action: 'block',
        reason: `Source policy does not grant AI processing or research permission.`,
        policy,
      };
    }

    return {
      allowed: true,
      action: 'allow',
      reason: `Source explicitly grants research and AI processing permissions.`,
      policy,
    };
  }

  /**
   * COMMERCIAL / PUBLISHING GATE: Check if source allows commercial publication.
   */
  async canPublishCommercial(sourceId: string): Promise<SourcePolicyDecision> {
    const policy = await this.getPolicy(sourceId);

    if (policy.review_status !== 'ALLOWED' || !policy.commercial_use_allowed) {
      return {
        allowed: false,
        action: 'review',
        reason: `Source does not permit automated commercial publication (${policy.review_status}). Human review required.`,
        policy,
      };
    }

    return {
      allowed: true,
      action: 'allow',
      reason: `Source permits commercial use.`,
      policy,
    };
  }

  /**
   * Evaluate all sources within a Research Item.
   * Returns allowed source items, restricted source items, policy snapshot, and eligibility.
   */
  async evaluateResearchSources(researchItemId: string): Promise<{
    allowedSourceItemIds: string[];
    excludedSourceItemIds: string[];
    policySnapshot: Array<{
      sourceId: string;
      sourceName: string;
      reviewStatus: PolicyStatus;
      aiAllowed: boolean;
      commercialAllowed: boolean;
      attributionRequired: boolean;
    }>;
    eligibleForAi: boolean;
    requiresHumanReview: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    // Fetch all source items linked to this research item
    const { results } = await this.db
      .prepare(`
        SELECT si.id as source_item_id, si.source_id, s.name as source_name
        FROM source_items si
        JOIN research_items ri ON ri.id = ?
        JOIN sources s ON si.source_id = s.id
        WHERE si.id IN (
          SELECT value FROM json_each(
            CASE 
              WHEN ri.source_item_ids IS NOT NULL AND ri.source_item_ids != '' 
              THEN ri.source_item_ids 
              ELSE '[]' 
            END
          )
        )
      `)
      .bind(researchItemId)
      .all<{ source_item_id: string; source_id: string; source_name: string }>();

    const items = results || [];
    const allowedSourceItemIds: string[] = [];
    const excludedSourceItemIds: string[] = [];
    const policySnapshot: any[] = [];

    const evaluatedSources = new Map<string, SourcePolicyDecision>();

    for (const item of items) {
      if (!evaluatedSources.has(item.source_id)) {
        const decision = await this.canProcessAi(item.source_id);
        evaluatedSources.set(item.source_id, decision);

        const p = decision.policy;
        policySnapshot.push({
          sourceId: item.source_id,
          sourceName: item.source_name,
          reviewStatus: p?.review_status || 'UNKNOWN',
          aiAllowed: Boolean(p?.ai_processing_allowed),
          commercialAllowed: Boolean(p?.commercial_use_allowed),
          attributionRequired: Boolean(p?.attribution_required),
        });
      }

      const decision = evaluatedSources.get(item.source_id)!;
      if (decision.allowed) {
        allowedSourceItemIds.push(item.source_item_id);
      } else {
        excludedSourceItemIds.push(item.source_item_id);
        reasons.push(`Source '${item.source_name}' excluded: ${decision.reason}`);
      }
    }

    const eligibleForAi = allowedSourceItemIds.length > 0;
    const requiresHumanReview = excludedSourceItemIds.length > 0 || !eligibleForAi;

    return {
      allowedSourceItemIds,
      excludedSourceItemIds,
      policySnapshot,
      eligibleForAi,
      requiresHumanReview,
      reasons,
    };
  }
}
