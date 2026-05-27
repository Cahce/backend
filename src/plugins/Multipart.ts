import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";

/**
 * Multipart plugin for file uploads
 *
 * Registers @fastify/multipart with size limits sourced from `app.config.upload`.
 * Default is 10 MB (set via MAX_UPLOAD_SIZE_BYTES env). Requests exceeding the
 * limit short-circuit with 413 before ever reaching the use case.
 *
 * Must run AFTER configPlugin (already enforced by registration order in app.ts).
 */
export async function registerMultipart(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: app.config.upload.maxBytes,
      files: 1, // Only 1 file per request
    },
  });
}
