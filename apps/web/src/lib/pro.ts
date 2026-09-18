import 'server-only';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import type { UserRecord } from './db';
import { type FeatureAvailability, FEATURES, planAllows } from './features';
import type { OverlayDoc } from './editor-types';

/**
 * Loader and contract for the paid add-on module.
 *
 * ## Why this exists
 *
 * MeDF is open core: everything in this repository is the free tier and can be
 * read, forked and self-hosted. Paid features are implemented in a **separate
 * private module** that is never committed here. This file is the only place
 * the two meet — it declares the interface, loads the module if the operator
 * installed one, and otherwise runs the free tier unchanged.
 *
 * ## Where the module comes from (first match wins)
 *
 *   1. `MEDF_PRO_MODULE` — absolute path to a built module (recommended in
 *      production: mounted at deploy time, never in the image's git history).
 *   2. `@medf/pro` — an optional npm dependency from a private registry.
 *   3. `src/pro-private/index.js` — a local working copy. This path is in
 *      `.gitignore` and `npm run guard:private` fails the build if anything
 *      under it is ever staged, so it cannot reach a public push.
 *
 * Setting `MEDF_PRO_DISABLE=1` skips all of the above and runs the pure
 * open-source build, which is what the CI tests assert against.
 *
 * ## What is genuinely hidden
 *
 * Code that runs on the server (export post-processing, API handlers) is never
 * sent to the browser, so subscribers cannot read it. Code that runs *in* the
 * browser can always be read by whoever it is served to — the gate below keeps
 * it away from non-subscribers and out of this repository, which is as far as
 * the web platform allows. Put the logic worth protecting in `server`.
 */

export interface ProExportContext {
  user: { id: string; plan: string };
  overlay: OverlayDoc;
  documentTitle: string;
}

export interface ProModule {
  id: string;
  version: string;
  /** Feature keys this module implements; must be declared in `features.ts`. */
  features: string[];
  /**
   * Server-side extension points. These run in the Next.js process and are
   * never exposed to the browser.
   */
  server?: {
    /** Runs after the core renderer, e.g. OCR, redaction, compression. */
    transformExport?: (bytes: Uint8Array, context: ProExportContext) => Promise<Uint8Array>;
    /**
     * Handlers mounted under `/api/pro/<name>`, called only for members whose
     * plan entitles them to `feature`.
     */
    handlers?: Record<
      string,
      { feature: string; handle: (request: Request, user: UserRecord) => Promise<Response> }
    >;
  };
  /**
   * Absolute path to a client bundle served at `/api/pro/client.js`, only to
   * entitled members. Optional.
   */
  clientBundle?: string;
}

interface ProState {
  module: ProModule | null;
  loaded: boolean;
  error: string | null;
}

const globalState = globalThis as typeof globalThis & { __medfPro?: ProState };
const state: ProState = (globalState.__medfPro ??= { module: null, loaded: false, error: null });

/** `MEDF_PRO_DISABLE=1` forces the pure open-source build, ignoring any module. */
function proDisabled(): boolean {
  const raw = process.env.MEDF_PRO_DISABLE?.trim();
  return raw === '1' || raw === 'true';
}

function candidatePaths(): string[] {
  const fromEnv = process.env.MEDF_PRO_MODULE?.trim();
  return [
    ...(fromEnv ? [fromEnv] : []),
    '@medf/pro',
    path.join(process.cwd(), 'src', 'pro-private', 'index.js'),
    path.join(process.cwd(), 'apps', 'web', 'src', 'pro-private', 'index.js'),
  ];
}

function validate(candidate: unknown, origin: string): ProModule {
  const addon = candidate as Partial<ProModule> | undefined;
  if (!addon || typeof addon !== 'object') {
    throw new Error(`โมดูลที่ ${origin} ไม่ได้ export object`);
  }
  if (!addon.id || !addon.version || !Array.isArray(addon.features)) {
    throw new Error(`โมดูลที่ ${origin} ขาดฟิลด์ id, version หรือ features`);
  }
  const unknown = addon.features.filter((key) => !(key in FEATURES));
  if (unknown.length > 0) {
    throw new Error(
      `โมดูลที่ ${origin} ประกาศฟีเจอร์ที่ไม่มีใน features.ts: ${unknown.join(', ')}`,
    );
  }
  return addon as ProModule;
}

/**
 * Loads the paid module once per process. A missing module is the normal case
 * (the open-source build), so it is not an error; a *broken* module is logged
 * and ignored so the free tier keeps working.
 */
export function loadProModule(): ProModule | null {
  if (state.loaded) return state.module;
  state.loaded = true;

  if (proDisabled()) {
    console.log('[medf] MEDF_PRO_DISABLE is set — running the open-source build');
    return null;
  }

  const require = createRequire(import.meta.url);
  for (const candidate of candidatePaths()) {
    try {
      // A bare specifier is resolved as a package; a path must exist first.
      if (candidate.includes(path.sep) && !fs.existsSync(candidate)) continue;
      // Resolved at runtime on purpose: the bundler must not try to inline a
      // module that is absent from this repository.
      const imported = require(/* turbopackIgnore: true */ candidate);
      state.module = validate(imported.default ?? imported, candidate);
      console.log(
        `[medf] loaded paid module ${state.module.id}@${state.module.version} (${state.module.features.length} features)`,
      );
      return state.module;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') continue;
      state.error = (error as Error).message;
      console.warn(`[medf] ไม่สามารถโหลดโมดูลเสริมจาก ${candidate}: ${state.error}`);
    }
  }
  return null;
}

export function proModuleInstalled(): boolean {
  return loadProModule() !== null;
}

/** Feature keys this installation can actually serve. */
export function installedFeatureKeys(): Set<string> {
  const addon = loadProModule();
  const keys = new Set<string>();
  for (const feature of Object.values(FEATURES)) {
    if (feature.source === 'core') keys.add(feature.key);
  }
  for (const key of addon?.features ?? []) keys.add(key);
  return keys;
}

/** The single gate: entitled by plan **and** installed on this server. */
export function canUseFeature(user: Pick<UserRecord, 'plan'>, key: string): boolean {
  return planAllows(user.plan, key) && installedFeatureKeys().has(key);
}

export function featureAvailability(user: Pick<UserRecord, 'plan'>): FeatureAvailability[] {
  const installed = installedFeatureKeys();
  return Object.values(FEATURES).map((feature) => {
    const entitled = planAllows(user.plan, feature.key);
    const present = installed.has(feature.key);
    return {
      key: feature.key,
      label: feature.label,
      description: feature.description,
      plan: feature.plan,
      source: feature.source,
      available: entitled && present,
      reason: !present ? 'not_installed' : entitled ? undefined : 'plan',
    };
  });
}

/**
 * Export hook. Returns the bytes unchanged when no module is installed or the
 * member is not entitled, so the core path is always the same code.
 */
export async function applyProExportTransform(
  bytes: Uint8Array,
  context: ProExportContext,
  user: Pick<UserRecord, 'plan'>,
): Promise<Uint8Array> {
  const addon = loadProModule();
  const transform = addon?.server?.transformExport;
  if (!transform) return bytes;

  // Only run for members entitled to at least one feature of this module.
  const entitled = addon.features.some((key) => canUseFeature(user, key));
  if (!entitled) return bytes;

  try {
    return await transform(bytes, context);
  } catch (error) {
    // A failing add-on must never break a member's export.
    console.error('[medf] paid module transformExport failed', error);
    return bytes;
  }
}
