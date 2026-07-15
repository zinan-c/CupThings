import type { FastifyReply } from "fastify";
import { ZodError, type ZodSchema } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export function parseInput<T>(schema: ZodSchema<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, error.issues.map((issue) => issue.message).join("; "));
    }
    throw error;
  }
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  console.error(error);
  return reply.status(500).send({ error: "Internal server error" });
}
