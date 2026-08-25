/**
 * Runware Image Generation Provider
 * Implementation for FLUX.1 [schnell] model (runware:100@1) via official Runware API.
 */

import type { ImageGenerationProvider, ImageGenerationRequest, ImageGenerationResult } from '../types';
import { logError, logInfo } from '../../utils/logger';

const RUNWARE_API_URL = 'https://api.runware.ai/v1';
const DEFAULT_MODEL = 'runware:100@1'; // FLUX.1 [schnell]

export class RunwareProvider implements ImageGenerationProvider {
  public readonly name = 'runware';

  constructor(private readonly apiKey: string) {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('RUNWARE_API_KEY is missing. Please configure RUNWARE_API_KEY in Cloudflare environment secrets.');
    }
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const taskUUID = request.jobId || crypto.randomUUID();
    const model = request.model || DEFAULT_MODEL;

    const payload = [
      {
        taskType: 'imageInference',
        taskUUID,
        positivePrompt: request.positivePrompt,
        negativePrompt: request.negativePrompt,
        model,
        width: request.width || 1344,
        height: request.height || 768,
        numberResults: 1,
        outputFormat: request.outputFormat || 'WEBP',
        outputType: 'URL',
        includeCost: true,
        checkNSFW: true,
        ...(request.seed !== undefined ? { seed: request.seed } : {}),
      },
    ];

    logInfo(`Initiating Runware image inference for task ${taskUUID} with model ${model}`);

    try {
      const response = await fetch(RUNWARE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey.trim()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logError(`Runware API returned HTTP ${response.status}: ${errorText}`);
        return {
          success: false,
          taskId: taskUUID,
          error: `Runware API error (${response.status}): ${errorText.slice(0, 300)}`,
        };
      }

      const jsonResponse: any = await response.json();

      // Check for errors returned in JSON payload
      if (jsonResponse.errors && jsonResponse.errors.length > 0) {
        const err = jsonResponse.errors[0];
        logError(`Runware returned task error for ${taskUUID}: ${JSON.stringify(err)}`);
        return {
          success: false,
          taskId: taskUUID,
          error: err.message || 'Runware inference rejected',
        };
      }

      // Check for valid data array
      const taskData = jsonResponse.data && jsonResponse.data[0];
      if (!taskData || !taskData.imageURL) {
        logError(`Runware response missing imageURL for task ${taskUUID}: ${JSON.stringify(jsonResponse)}`);
        return {
          success: false,
          taskId: taskUUID,
          error: 'Runware response did not return an image URL',
        };
      }

      const imageUrl = taskData.imageURL;
      const reportedCost = typeof taskData.cost === 'number' ? taskData.cost : 0.0;
      const seed = typeof taskData.seed === 'number' ? taskData.seed : undefined;

      // Download the image buffer from the Runware URL for R2 persistence
      const imageFetchRes = await fetch(imageUrl);
      if (!imageFetchRes.ok) {
        throw new Error(`Failed to download generated image from Runware CDN (${imageFetchRes.status})`);
      }

      const arrayBuffer = await imageFetchRes.arrayBuffer();
      const imageBuffer = new Uint8Array(arrayBuffer);

      if (imageBuffer.byteLength < 500) {
        throw new Error(`Downloaded image is corrupt or too small (${imageBuffer.byteLength} bytes)`);
      }

      logInfo(`Successfully downloaded generated image for task ${taskUUID} (${imageBuffer.byteLength} bytes, cost: $${reportedCost})`);

      return {
        success: true,
        imageBuffer,
        imageUrl,
        taskId: taskUUID,
        cost: reportedCost,
        seed,
        width: request.width || 1344,
        height: request.height || 768,
        format: request.outputFormat || 'WEBP',
      };
    } catch (error: any) {
      logError(`Exception in RunwareProvider for task ${taskUUID}`, error);
      return {
        success: false,
        taskId: taskUUID,
        error: error.message || 'Internal Runware generation exception',
      };
    }
  }
}
