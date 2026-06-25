import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ZMSG } from "../../../../../shared/validation/ZodMessages.js";
import type { UserRole } from "../../../domain/AccountManagement/Types.js";

/**
 * Request DTOs
 */
export const CreateAccountRequestSchema = z.object({
  email: z.string().min(1, ZMSG.required("Email")).email(ZMSG.emailInvalid),
  password: z.string().min(8, ZMSG.minLen("Mật khẩu", 8)),
  role: z.enum(["admin", "teacher", "student"]),
  isActive: z.boolean().optional().default(true),
  linkTo: z
    .object({
      type: z.enum(["teacher", "student"]),
      id: z.string(),
    })
    .optional(),
});

export type CreateAccountRequest = z.infer<typeof CreateAccountRequestSchema>;

export const UpdateAccountRequestSchema = z.object({
  email: z.string().email(ZMSG.emailInvalid).optional(),
  role: z.enum(["admin", "teacher", "student"]).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateAccountRequest = z.infer<typeof UpdateAccountRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  newPassword: z.string().min(8, ZMSG.minLen("Mật khẩu", 8)),
});

export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const ListAccountsQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(["admin", "teacher", "student"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  hasLink: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ListAccountsQuery = z.infer<typeof ListAccountsQuerySchema>;

/**
 * Response DTOs
 */
export interface AccountLinkResponse {
  type: "teacher" | "student";
  id: string;
  fullName: string;
  code: string;
}

export interface AccountResponse {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  link: AccountLinkResponse | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListAccountsResponse {
  items: AccountResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MessageResponse {
  message: string;
}

/**
 * JSON Schemas derived from Zod for Fastify route validation.
 * Do not pass raw Zod schemas to Fastify — they are not valid JSON Schema.
 */

function unwrapJsonSchema(schema: unknown): Record<string, unknown> {
  const s = schema as Record<string, unknown>;
  if ("$ref" in s && "definitions" in s) {
    const refName = (s.$ref as string).replace("#/definitions/", "");
    const defs = s.definitions as Record<string, unknown>;
    return defs[refName] as Record<string, unknown>;
  }
  const { $schema, ...rest } = s;
  return rest;
}

export const CreateAccountBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(CreateAccountRequestSchema as any, "CreateAccountRequest"),
);

export const UpdateAccountBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(UpdateAccountRequestSchema as any, "UpdateAccountRequest"),
);

export const ResetPasswordBodyJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ResetPasswordRequestSchema as any, "ResetPasswordRequest"),
);

export const ListAccountsQueryJsonSchema = unwrapJsonSchema(
  zodToJsonSchema(ListAccountsQuerySchema as any, "ListAccountsQuery"),
);
