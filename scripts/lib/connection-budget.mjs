import { z } from 'zod';

const count = z.number().int().min(0).max(10000);
const positive = z.number().int().min(1).max(10000);
const name = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/);
const placement = { replicas: count, surge: count, terminating: count };
const schema = z.object({
  version: z.literal(1), mode: z.enum(['direct', 'transaction']),
  primary: z.object({ maxConnections: positive, reservedSlots: count, headroom: count, externalConnections: count }).strict(),
  processes: z.array(z.object({ name, ...placement, processesPerReplica: positive,
    poolMax: count, directConnectionsPerProcess: count }).strict()).min(1).max(32),
  poolers: z.array(z.object({ name, ...placement, maxClientConnections: positive, clientReserve: count,
    configFile: z.string().min(1).max(512),
    databases: z.array(z.object({ alias: name, maxConnections: positive }).strict()).min(1).max(32),
  }).strict()).max(32),
}).strict();

const peak = value => value.replicas + value.surge + value.terminating;
const unique = values => new Set(values).size === values.length;

/** Declared envelopes, not observations of a running database or a throughput prediction. */
export function evaluateConnectionBudget(input) {
  const plan = schema.parse(input);
  if (!unique(plan.processes.map(item => item.name)) || !unique(plan.poolers.map(item => item.name)) ||
      plan.poolers.some(item => !unique(item.databases.map(db => db.alias)))) throw new Error('Duplicate budget names');
  if ((plan.mode === 'transaction' && (!plan.poolers.length || plan.poolers.some(item => item.replicas < 1))) ||
      (plan.mode === 'direct' && plan.poolers.length)) throw new Error('Pooler inventory does not match routing mode');
  const processes = plan.processes.map(item => ({ name: item.name, peakProcesses: peak(item) * item.processesPerReplica,
    poolConnections: peak(item) * item.processesPerReplica * item.poolMax,
    directConnections: peak(item) * item.processesPerReplica * item.directConnectionsPerProcess }));
  const poolConnections = processes.reduce((sum, item) => sum + item.poolConnections, 0);
  const directConnections = processes.reduce((sum, item) => sum + item.directConnections, 0);
  const poolers = plan.poolers.map(item => ({ name: item.name, peakInstances: peak(item),
    serverConnections: peak(item) * item.databases.reduce((sum, db) => sum + db.maxConnections, 0),
    // No average distribution assumption: a single survivor must accept all clients.
    failoverClientDemand: poolConnections + item.clientReserve, clientCapacity: item.maxClientConnections }));
  const serverConnections = plan.mode === 'direct' ? poolConnections : poolers.reduce((sum, item) => sum + item.serverConnections, 0);
  const required = serverConnections + directConnections + plan.primary.externalConnections + plan.primary.headroom;
  const available = plan.primary.maxConnections - plan.primary.reservedSlots;
  const violations = [];
  if (available < required) violations.push('Primary connection envelope exceeds available slots');
  for (const item of poolers) if (item.failoverClientDemand > item.clientCapacity) violations.push(`Pooler ${item.name} cannot accept peak clients after failover`);
  return { plan, passed: !violations.length, available, required, spare: available - required, poolConnections,
    directConnections, serverConnections, processes, poolers, violations };
}

/** Intentionally supports the explicit, bounded INI used by this deployment, not arbitrary includes/wildcards. */
export function verifyPoolerConfig(text, pooler) {
  const sections = { databases: new Map(), pgbouncer: new Map() };
  let section;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^[;#]/.test(line)) continue;
    const heading = /^\[([^\]]+)\]$/.exec(line);
    if (heading) {
      if (!Object.hasOwn(sections, heading[1])) throw new Error('Unsupported INI section; review its budget impact');
      section = sections[heading[1]]; continue;
    }
    const entry = /^([^=\s]+)\s*=\s*(.*)$/.exec(line);
    if (!section || !entry || section.has(entry[1])) throw new Error('Unsupported or duplicate INI setting');
    section.set(entry[1], entry[2]);
  }
  const settings = sections.pgbouncer;
  if (settings.has('%include') || settings.has('include') || settings.get('pool_mode') !== 'transaction' ||
      settings.get('auth_type') !== 'scram-sha-256') throw new Error('Expected explicit transaction pooling and SCRAM authentication');
  const integer = value => {
    if (!/^\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error('Expected a positive bounded INI connection limit');
    return Number(value);
  };
  if (integer(settings.get('max_client_conn')) !== pooler.maxClientConnections) throw new Error('max_client_conn differs from manifest');
  integer(settings.get('max_prepared_statements'));
  const defaultCap = integer(settings.get('max_db_connections'));
  if (sections.databases.size !== pooler.databases.length) throw new Error('Database alias inventory differs from manifest');
  for (const db of pooler.databases) {
    const value = sections.databases.get(db.alias);
    if (!value) throw new Error('Missing database alias');
    const attributes = new Map();
    for (const token of value.split(/\s+/)) {
      const part = /^([a-z_]+)=(\S+)$/.exec(token);
      if (!part || !['host', 'port', 'dbname', 'max_db_connections'].includes(part[1]) || attributes.has(part[1])) {
        throw new Error('Unsupported or duplicate database attribute; review its budget impact');
      }
      attributes.set(part[1], part[2]);
    }
    const override = attributes.get('max_db_connections');
    if ((override === undefined ? defaultCap : integer(override)) !== db.maxConnections) throw new Error(`Server cap differs for alias ${db.alias}`);
  }
}
