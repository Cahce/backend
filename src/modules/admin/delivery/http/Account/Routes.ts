import type { FastifyInstance } from "fastify";
import {
  CreateAccountRequestSchema,
  UpdateAccountRequestSchema,
  ResetPasswordRequestSchema,
  ListAccountsQuerySchema,
  CreateAccountBodyJsonSchema,
  UpdateAccountBodyJsonSchema,
  ResetPasswordBodyJsonSchema,
  ListAccountsQueryJsonSchema,
  type AccountResponse,
  type ListAccountsResponse,
  type MessageResponse,
} from "./Dto.js";
import { AdminContainer } from "../../../Container.js";
import { FileParser } from "../../../infra/FileParser.js";

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  const container = new AdminContainer(app.prisma);
  const {
    createAccountUseCase,
    listAccountsUseCase,
    getAccountUseCase,
    updateAccountUseCase,
    deleteAccountUseCase,
    resetAccountPasswordUseCase: resetPasswordUseCase,
  } = container;
  const importAccounts = container.importAccounts;

  // POST /admin/accounts - Create account
  app.post<{ Body: unknown }>(
    "/accounts",
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        tags: ["Admin - Accounts"],
        summary: "Create a new account",
        body: CreateAccountBodyJsonSchema,
        response: {
          201: {
            description: "Account created successfully",
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["admin", "teacher", "student"] },
              isActive: { type: "boolean" },
              link: {
                type: ["object", "null"],
                properties: {
                  type: { type: "string", enum: ["teacher", "student"] },
                  id: { type: "string" },
                  fullName: { type: "string" },
                  code: { type: "string" },
                },
              },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = CreateAccountRequestSchema.parse(request.body);
      const result = await createAccountUseCase.execute(body);

      if (!result.success) {
        return reply.code(getStatusCodeForError(result.error.code)).send({
          error: result.error,
        });
      }

      // If linkTo was provided, refetch to include link info
      let link: AccountResponse["link"] = null;
      if (body.linkTo) {
        const withLink = await getAccountUseCase.execute({ id: result.data.id });
        if (withLink.success) {
          link = withLink.data.link;
        }
      }

      const response: AccountResponse = {
        id: result.data.id,
        email: result.data.email,
        role: result.data.role,
        isActive: result.data.isActive,
        link,
        createdAt: result.data.createdAt.toISOString(),
        updatedAt: result.data.updatedAt.toISOString(),
      };
      return reply.code(201).send(response);
    }
  );

  // GET /admin/accounts - List accounts
  app.get<{ Querystring: unknown }>(
    "/accounts",
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        tags: ["Admin - Accounts"],
        summary: "List accounts with filtering and pagination",
        querystring: ListAccountsQueryJsonSchema,
        response: {
          200: {
            description: "List of accounts",
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    role: {
                      type: "string",
                      enum: ["admin", "teacher", "student"],
                    },
                    isActive: { type: "boolean" },
                    link: {
                      type: ["object", "null"],
                      properties: {
                        type: { type: "string", enum: ["teacher", "student"] },
                        id: { type: "string" },
                        fullName: { type: "string" },
                        code: { type: "string" },
                      },
                    },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                  },
                },
              },
              total: { type: "number" },
              page: { type: "number" },
              pageSize: { type: "number" },
              totalPages: { type: "number" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = ListAccountsQuerySchema.parse(request.query);
      const result = await listAccountsUseCase.execute({
        ...query,
        isActive:
          query.isActive === "true"
            ? true
            : query.isActive === "false"
              ? false
              : undefined,
        hasLink:
          query.hasLink === "true"
            ? true
            : query.hasLink === "false"
              ? false
              : undefined,
      });

      if (!result.success) {
        return reply.code(getStatusCodeForError(result.error.code)).send({
          error: result.error,
        });
      }

      const response: ListAccountsResponse = {
        items: result.data.items.map((item) => ({
          id: item.id,
          email: item.email,
          role: item.role,
          isActive: item.isActive,
          link: item.link,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        total: result.data.total,
        page: result.data.page,
        pageSize: result.data.pageSize,
        totalPages: result.data.totalPages,
      };
      return reply.send(response);
    }
  );

  // GET /admin/accounts/:id - Get account by ID
  app.get<{ Params: { id: string } }>(
    "/accounts/:id",
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        tags: ["Admin - Accounts"],
        summary: "Get account by ID",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        response: {
          200: {
            description: "Account details",
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["admin", "teacher", "student"] },
              isActive: { type: "boolean" },
              link: {
                type: ["object", "null"],
                properties: {
                  type: { type: "string", enum: ["teacher", "student"] },
                  id: { type: "string" },
                  fullName: { type: "string" },
                  code: { type: "string" },
                },
              },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await getAccountUseCase.execute({ id: request.params.id });
      if (!result.success) {
        return reply.code(getStatusCodeForError(result.error.code)).send({
          error: result.error,
        });
      }
      const account = result.data;
      const response: AccountResponse = {
        id: account.id,
        email: account.email,
        role: account.role,
        isActive: account.isActive,
        link: account.link,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      };
      return reply.send(response);
    }
  );

  // PATCH /admin/accounts/:id - Update account
  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/accounts/:id",
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        tags: ["Admin - Accounts"],
        summary: "Update account",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: UpdateAccountBodyJsonSchema,
        response: {
          200: {
            description: "Account updated successfully",
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["admin", "teacher", "student"] },
              isActive: { type: "boolean" },
              link: {
                type: ["object", "null"],
                properties: {
                  type: { type: "string", enum: ["teacher", "student"] },
                  id: { type: "string" },
                  fullName: { type: "string" },
                  code: { type: "string" },
                },
              },
              createdAt: { type: "string" },
              updatedAt: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = UpdateAccountRequestSchema.parse(request.body);
      const result = await updateAccountUseCase.execute({
        id: request.params.id,
        ...body,
      });

      if (!result.success) {
        return reply.code(getStatusCodeForError(result.error.code)).send({
          error: result.error,
        });
      }

      // Fetch with link info for response
      const withLink = await getAccountUseCase.execute({ id: result.data.id });
      if (!withLink.success) {
        return reply.code(getStatusCodeForError(withLink.error.code)).send({
          error: withLink.error,
        });
      }
      const account = withLink.data;
      const response: AccountResponse = {
        id: account.id,
        email: account.email,
        role: account.role,
        isActive: account.isActive,
        link: account.link,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      };
      return reply.send(response);
    }
  );

  // DELETE /admin/accounts/:id - Delete account
  app.delete<{ Params: { id: string } }>(
    "/accounts/:id",
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        tags: ["Admin - Accounts"],
        summary: "Delete account",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        response: {
          204: {
            description: "Account deleted successfully",
            type: "null",
          },
        },
      },
    },
    async (request, reply) => {
      const result = await deleteAccountUseCase.execute({ id: request.params.id });
      if (!result.success) {
        return reply.code(getStatusCodeForError(result.error.code)).send({
          error: result.error,
        });
      }
      return reply.code(204).send();
    }
  );

  // POST /admin/accounts/:id/reset-password - Reset password
  app.post<{ Params: { id: string }; Body: unknown }>(
    "/accounts/:id/reset-password",
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        tags: ["Admin - Accounts"],
        summary: "Reset account password",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: ResetPasswordBodyJsonSchema,
        response: {
          200: {
            description: "Password reset successfully",
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
      },
    },
    async (request, reply) => {
      const body = ResetPasswordRequestSchema.parse(request.body);
      const result = await resetPasswordUseCase.execute({
        id: request.params.id,
        newPassword: body.newPassword,
      });
      if (!result.success) {
        return reply.code(getStatusCodeForError(result.error.code)).send({
          error: result.error,
        });
      }
      const response: MessageResponse = {
        message: "Đặt lại mật khẩu thành công",
      };
      return reply.send(response);
    }
  );

  // POST /admin/accounts/import - Import accounts from XLSX or CSV file
  app.post(
    "/accounts/import",
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        tags: ["Admin - Accounts"],
        summary:
          "Import accounts from XLSX (priority) or CSV (fallback) with optional linking",
        consumes: ["multipart/form-data"],
        response: {
          200: {
            description: "Import result",
            type: "object",
            properties: {
              total: { type: "number" },
              created: { type: "number" },
              skipped: { type: "number" },
              failed: { type: "number" },
              errors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    row: { type: "number" },
                    code: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
              generatedPasswords: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    row: { type: "number" },
                    email: { type: "string" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          400: {
            description: "File không hợp lệ",
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
          413: {
            description: "File quá lớn",
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const data = await request.file();
        if (!data) {
          return reply.code(400).send({
            error: { code: "NO_FILE", message: "Không tìm thấy file" },
          });
        }
        const mimeValidation = FileParser.validateMimeType(data.mimetype);
        if (!mimeValidation.valid) {
          return reply.code(400).send({
            error: {
              code: "INVALID_FILE_TYPE",
              message: "Chỉ chấp nhận file XLSX hoặc CSV",
            },
          });
        }
        if (data.filename.toLowerCase().endsWith(".xlsm")) {
          return reply.code(400).send({
            error: {
              code: "INVALID_FILE_TYPE",
              message:
                "Không chấp nhận file .xlsm (có macro). Vui lòng sử dụng file .xlsx",
            },
          });
        }
        const buffer = await data.toBuffer();
        const maxSize = 5 * 1024 * 1024;
        if (buffer.length > maxSize) {
          return reply.code(413).send({
            error: {
              code: "FILE_TOO_LARGE",
              message: "File quá lớn. Kích thước tối đa: 5MB",
            },
          });
        }
        const parsed = FileParser.parseSpreadsheet(buffer, data.mimetype);
        const maxRows = 5000;
        if (parsed.rows.length > maxRows) {
          return reply.code(413).send({
            error: {
              code: "TOO_MANY_ROWS",
              message: `File có quá nhiều dòng. Tối đa: ${maxRows} dòng`,
            },
          });
        }
        const result = await importAccounts.execute(parsed.rows);
        return reply.code(200).send(result);
      } catch (error) {
        return reply.code(400).send({
          error: {
            code: "IMPORT_ERROR",
            message: error instanceof Error ? error.message : "Lỗi nhập file",
          },
        });
      }
    }
  );

  // GET /admin/accounts/import/template - Download XLSX or CSV template
  app.get<{ Querystring: { format?: "xlsx" | "csv" } }>(
    "/accounts/import/template",
    {
      preHandler: app.auth.requireAdmin,
      schema: {
        tags: ["Admin - Accounts"],
        summary: "Download XLSX (default) or CSV template for account import",
        querystring: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["xlsx", "csv"],
            },
          },
        },
        response: {
          200: { description: "Template file", type: "string" },
        },
      },
    },
    async (request, reply) => {
      const format = request.query.format || "xlsx";
      const headers = [
        "STT",
        "Email",
        "Mật Khẩu",
        "Vai trò",
        "Kích hoạt",
        "Loại liên kết",
        "Mã liên kết",
      ];
      const exampleRow = {
        STT: "1",
        Email: "admin@tlu.edu.vn",
        "Mật Khẩu": "",
        "Vai trò": "admin",
        "Kích hoạt": "true",
        "Loại liên kết": "",
        "Mã liên kết": "",
      };

      if (format === "xlsx") {
        const buffer = FileParser.buildXlsxTemplate(headers, exampleRow);
        return reply
          .header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          )
          .header(
            "Content-Disposition",
            'attachment; filename="tai_khoan_mau.xlsx"'
          )
          .send(buffer);
      }
      const template = FileParser.buildCsvTemplate(headers, exampleRow);
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          'attachment; filename="tai_khoan_mau.csv"'
        )
        .send(template);
    }
  );
}

function getStatusCodeForError(errorCode: string): number {
  switch (errorCode) {
    case "INVALID_EMAIL_FORMAT":
    case "INVALID_EMAIL_DOMAIN":
    case "INVALID_ROLE":
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "ACCOUNT_NOT_FOUND":
      return 404;
    case "EMAIL_EXISTS":
    case "ACCOUNT_HAS_LINK":
    case "ACCOUNT_ALREADY_LINKED_TO_TEACHER":
    case "ACCOUNT_ALREADY_LINKED_TO_STUDENT":
    case "ACCOUNT_NOT_LINKED":
    case "ROLE_MISMATCH":
      return 409;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}
