import type { FastifySchema, RouteShorthandOptions } from 'fastify';
import { z } from 'zod';

export interface OperationContract {
  operationId: string;
  summary: string;
  description: string;
  tag: string;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  bodyContentType?: string;
  transformUrl?: (url: string) => string;
  responses: Record<number, {
    description: string;
    schema?: z.ZodType;
    content?: Record<string, z.ZodType>;
    headers?: Record<string, z.ZodType>;
  }>;
}
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }).strict() }).strict();
export const commonErrorResponses = {
  400: { description: 'Dữ liệu hoặc cursor không hợp lệ (VALIDATION_ERROR, INVALID_CURSOR).', schema: apiErrorSchema },
  401: { description: 'Thiếu Bearer token, phiên hết hạn hoặc đã thu hồi.', schema: apiErrorSchema },
  403: { description: 'Không đủ quyền project, quyền nhận xét hoặc chỉ dành cho chủ project.', schema: apiErrorSchema },
  404: { description: 'Không tìm thấy đối tượng trong project, hoặc link không còn khả dụng.', schema: apiErrorSchema },
  429: { description: 'Vượt giới hạn request, link hoặc kết nối. Retry-After nếu limiter cung cấp.', schema: apiErrorSchema },
  500: { description: 'Lỗi hệ thống.', schema: apiErrorSchema },
  503: { description: 'Dịch vụ tạm thời bận hoặc shared state chưa sẵn sàng.', schema: apiErrorSchema },
};
export const conflictResponse = { description: 'Revision/version đã thay đổi hoặc idempotency key được dùng cho nội dung khác.', schema: apiErrorSchema };

function toOpenApiSchema(schema: z.ZodType, io: 'input' | 'output') {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0', io,
    override: ({ zodSchema, jsonSchema }) => {
      // OpenAPI nullable extends type, but enum remains a separate constraint.
      if (jsonSchema.nullable === true && jsonSchema.enum && !jsonSchema.enum.includes(null)) {
        jsonSchema.enum = [...jsonSchema.enum, null];
      }
      // Zod 4's OpenAPI conversion can omit the bound for an exclusive integer constraint.
      // Recover its numeric value from the same DTO's Draft 7 conversion.
      if ((jsonSchema.exclusiveMinimum === true && jsonSchema.minimum === undefined)
        || (jsonSchema.exclusiveMaximum === true && jsonSchema.maximum === undefined)) {
        const numeric = z.toJSONSchema(zodSchema, { target: 'draft-7', io });
        if (typeof numeric.exclusiveMinimum === 'number') jsonSchema.minimum = numeric.exclusiveMinimum;
        if (typeof numeric.exclusiveMaximum === 'number') jsonSchema.maximum = numeric.exclusiveMaximum;
      }
    },
  });
}

/** Documentation only: do not add an AJV validator or response serializer to a Zod route. */
export function documentOperation(contract: OperationContract): Pick<RouteShorthandOptions, 'config'> {
  const schema: FastifySchema = {
    operationId: contract.operationId, summary: contract.summary, description: contract.description,
    tags: [contract.tag], security: [{ bearerAuth: [] }],
    ...(contract.params ? { params: toOpenApiSchema(contract.params, 'input') } : {}),
    ...(contract.query ? { querystring: toOpenApiSchema(contract.query, 'input') } : {}),
    ...(contract.body ? { body: toOpenApiSchema(contract.body, 'input') } : {}),
    ...(contract.bodyContentType ? { consumes: [contract.bodyContentType] } : {}),
    response: Object.fromEntries(Object.entries(contract.responses).map(([status, response]) => [status, {
      ...(response.content ? {
        content: Object.fromEntries(Object.entries(response.content).map(([media, value]) => [media, {
          schema: toOpenApiSchema(value, 'output'),
        }])),
      } : response.schema ? toOpenApiSchema(response.schema, 'output') : { type: 'null' }),
      ...(response.headers ? {
        headers: Object.fromEntries(Object.entries(response.headers).map(([name, value]) => [name, toOpenApiSchema(value, 'output')])),
      } : {}),
      description: response.description,
    }])),
  };
  return { config: { swaggerTransform: ({ schema: existing, url }) => ({
    schema: { ...existing, ...schema }, url: contract.transformUrl?.(url) ?? url,
  }) } };
}
