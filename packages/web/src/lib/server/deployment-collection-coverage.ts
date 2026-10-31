import { callOperationalRpc, hasExactKeys } from './operational-rpc'

export const collectionScopes = ['synchronous_archive_assembly', 'project_hub_audio_put_reports'] as const
export type CollectionScope = typeof collectionScopes[number]
export type CollectorBuildHash =
  | { configured: false }
  | { configured: true; valid: true; buildHash: string }
  | { configured: true; valid: false }
export type DeploymentCoverageSeal = { schemaVersion: 1; scope: CollectionScope; releaseHash: string; cutoverAt: string }

export function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && value.length === 64 && /^[0-9a-f]{64}$/.test(value)
}

/**
 * Collector build identity for this server instance. Unset keeps the legacy, unattributed
 * writers; a set-but-malformed value fails closed instead of silently becoming unattributed.
 */
export function readCollectorBuildHash(value: string | undefined = process.env.OPERATIONAL_COLLECTOR_BUILD_HASH): CollectorBuildHash {
  if (value === undefined) return { configured: false }
  return isSha256Hex(value) ? { configured: true, valid: true, buildHash: value } : { configured: true, valid: false }
}

const microsecondUtc = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}Z$/

function validCutoverAt(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = value.match(microsecondUtc)
  if (!match || match[1] === '0000') return false
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value.slice(0, 10)
}

/**
 * Record that `releaseHash` has fully replaced older collectors for `scope`. This is an
 * operator assertion bound to DB time; it is not itself proof of fleet retirement.
 * Single bounded RPC, never retried: an unknown result stays unknown.
 */
export async function sealDeploymentCollectionCoverage(
  scope: CollectionScope, releaseHash: string, signal?: AbortSignal,
): Promise<DeploymentCoverageSeal | null> {
  if (!collectionScopes.includes(scope) || !isSha256Hex(releaseHash)) return null
  const result = await callOperationalRpc('seal_deployment_collection_coverage', {
    p_scope: scope, p_release_hash: releaseHash,
  }, signal)
  if (!result.ok) return null
  const data = result.data
  if (!hasExactKeys(data, ['schemaVersion', 'scope', 'releaseHash', 'cutoverAt']) ||
      data.schemaVersion !== 1 || data.scope !== scope || data.releaseHash !== releaseHash ||
      !validCutoverAt(data.cutoverAt)) return null
  return { schemaVersion: 1, scope, releaseHash, cutoverAt: data.cutoverAt }
}
