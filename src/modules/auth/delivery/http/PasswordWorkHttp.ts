import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PasswordWorkAdmission } from '../../application/PasswordWorkAdmission.js';
import { PasswordWorkUnavailable } from '../../domain/PasswordWorkUnavailable.js';

/** Cancel queued work when the peer leaves; application code stays transport independent. */
export async function runPasswordWork<T>(admission: PasswordWorkAdmission, request: FastifyRequest,
    reply: FastifyReply, work: () => Promise<T>): Promise<{ value: T } | undefined> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.raw.once('aborted', abort);
    reply.raw.once('close', abort);
    if (request.raw.aborted || reply.raw.destroyed) abort();
    try {
        return { value: await admission.run(work, controller.signal) };
    } catch (error) {
        if (!(error instanceof PasswordWorkUnavailable)) throw error;
        reply.header('Retry-After', '1').code(503).send({ error: { code: error.code, message: error.message } });
        return undefined;
    } finally {
        request.raw.removeListener('aborted', abort);
        reply.raw.removeListener('close', abort);
    }
}
