import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";

export async function registerMultipart(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: app.config.upload.maxBytes,
      files: 1,
    },
  });
}
