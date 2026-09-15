import {
       assetUrl,
       type PianoAsset,
       type PianoManifest,
} from "./pianoAssetManifest";

export type PianoLoadState = Readonly<{
       status:
              | "idle"
              | "loading"
              | "ready"
              | "degraded"
              | "superseded"
              | "disposed";
       generation: number;
       completed: number;
       successful: number;
       failed: number;
       pending: number;
       bootstrapReady: boolean;
       failures: readonly PianoLoadFailure[];
}>;
export type PianoReadiness =
       | "idle"
       | "bootstrap-ready"
       | "ready"
       | "degraded"
       | "superseded"
       | "disposed";
export interface PianoLoadFailure {
       readonly assetId: string;
       readonly phase: "fetch" | "decode";
       readonly error: string;
}
export interface PianoLoadPlan {
       bootstrapIds: readonly string[];
       seedIds: readonly string[];
       priorityIds?: readonly string[];
       visible?: boolean;
       saveData?: boolean;
}
export interface PianoLoader {
       request(assetId: string, priority?: number): Promise<AudioBuffer>;
       startPlan(plan: PianoLoadPlan, generation?: number): Promise<void>;
       subscribe(listener: (state: PianoLoadState) => void): () => void;
       prewarm(plan: readonly string[], generation?: number): Promise<void>;
       cancel(generation?: number): void;
       dispose(): void;
       state(): PianoLoadState;
       get(assetId: string): AudioBuffer | undefined;
}
export interface PianoLoaderOptions {
       baseUrl?: string;
       fetchImpl?: typeof fetch;
       concurrency?: number;
       decode?: (data: ArrayBuffer) => Promise<AudioBuffer>;
       bootstrapSeedIds?: readonly string[];
}

type Job = {
       asset: PianoAsset;
       decode: boolean;
       generation: number;
       resolve: (value: AudioBuffer) => void;
       reject: (reason: unknown) => void;
};
export function createProgressivePianoLoader(
       context: BaseAudioContext,
       manifest: PianoManifest,
       options: PianoLoaderOptions = {},
): PianoLoader {
       const fetcher = options.fetchImpl ?? fetch;
       const decode =
              options.decode ??
              ((data: ArrayBuffer) => context.decodeAudioData(data));
       const limit = options.concurrency ?? 2;
       const assets = new Map(manifest.assets.map((a) => [a.id, a]));
       const buffers = new Map<string, AudioBuffer>();
       const compressed = new Map<string, ArrayBuffer>();
       const used = new Map<string, number>();
       const pending = new Map<string, Promise<AudioBuffer>>();
       const queue: Job[] = [];
       const listeners = new Set<(s: PianoLoadState) => void>();
       const failures: PianoLoadFailure[] = [];
       const seed = new Set(
              options.bootstrapSeedIds ??
                     manifest.assets
                            .filter((a) => a.role === "attack" && a.layer === 8)
                            .slice(0, 8)
                            .map((a) => a.id),
       );
       let active = 0,
              generation = 0,
              disposed = false,
              completed = 0,
              successful = 0,
              cacheBytes = 0;
       let snapshot: PianoLoadState = Object.freeze({
              status: "idle",
              generation,
              completed,
              successful,
              failed: 0,
              pending: 0,
              bootstrapReady: false,
              failures: [],
       });
       const publish = (gen = generation) => {
              if (gen !== generation) return;
              const ready = [...seed].every((id) => buffers.has(id));
              const status = disposed
                     ? "disposed"
                     : ready && completed >= manifest.assets.length
                       ? "ready"
                       : ready
                         ? "loading"
                         : failures.some((f) => seed.has(f.assetId))
                           ? "degraded"
                           : active || queue.length
                             ? "loading"
                             : "idle";
              snapshot = Object.freeze({
                     status,
                     generation,
                     completed,
                     successful,
                     failed: failures.length,
                     pending: active + queue.length,
                     bootstrapReady: ready,
                     failures: Object.freeze([...failures]),
              });
              for (const listener of listeners) listener(snapshot);
       };
       const cache = (id: string, buffer: AudioBuffer) => {
              const size = buffer.length * buffer.numberOfChannels * 4;
              while (
                     (buffers.size >= 12 ||
                            cacheBytes + size > 96 * 1024 * 1024) &&
                     used.size
              ) {
                     const victim = [...used.keys()].find(
                            (key) => !seed.has(key),
                     );
                     if (!victim) break;
                     const old = buffers.get(victim);
                     cacheBytes -= old
                            ? old.length * old.numberOfChannels * 4
                            : 0;
                     buffers.delete(victim);
                     used.delete(victim);
              }
              buffers.set(id, buffer);
              used.set(id, Date.now());
              cacheBytes += size;
       };
       const pump = () => {
              while (!disposed && active < limit && queue.length) {
                     const job = queue.shift()!;
                     active++;
                     void (async () => {
                            try {
                                   let data = compressed.get(job.asset.id);
                                   if (!data) {
                                          const response = await fetcher(
                                                 assetUrl(
                                                        options.baseUrl ?? "",
                                                        job.asset.path,
                                                 ),
                                          );
                                          if (response.ok === false)
                                                 throw new Error(
                                                        `HTTP ${response.status}`,
                                                 );
                                          data = await response.arrayBuffer();
                                   }
                                   if (
                                          job.generation !== generation ||
                                          disposed
                                   )
                                          throw new Error("superseded");
                                   if (!compressed.has(job.asset.id))
                                          compressed.set(job.asset.id, data);
                                   if (job.decode) {
                                          const buffer = await decode(data);
                                          if (
                                                 job.generation !==
                                                        generation ||
                                                 disposed
                                          )
                                                 throw new Error("superseded");
                                          cache(job.asset.id, buffer);
                                          successful++;
                                          job.resolve(buffer);
                                   } else {
                                          // SAFETY: fetch-only plan jobs intentionally resolve without a decoded buffer; callers ignore this sentinel.
                                          job.resolve(
                                                 undefined as unknown as AudioBuffer,
                                          );
                                   }
                                   completed++;
                            } catch (error) {
                                   if (
                                          job.generation === generation &&
                                          !disposed
                                   ) {
                                          completed++;
                                          failures.push({
                                                 assetId: job.asset.id,
                                                 phase: String(
                                                        error,
                                                 ).startsWith("HTTP")
                                                        ? "fetch"
                                                        : "decode",
                                                 error:
                                                        error instanceof Error
                                                               ? error.message
                                                               : String(error),
                                          });
                                   }
                                   job.reject(error);
                            } finally {
                                   active--;
                                   publish(job.generation);
                                   pump();
                            }
                     })();
              }
              publish();
       };
       const schedule = (
              id: string,
              decodeIt: boolean,
              gen: number,
       ): Promise<AudioBuffer> => {
              if (disposed) return Promise.reject(new Error("loader disposed"));
              const cached = buffers.get(id);
              if (decodeIt && cached) {
                     used.set(id, Date.now());
                     return Promise.resolve(cached);
              }
              const key = decodeIt ? id : `fetch:${id}`;
              const existing = pending.get(key);
              if (existing) return existing;
              const asset = assets.get(id);
              if (!asset)
                     return Promise.reject(
                            new Error(`unknown piano asset: ${id}`),
                     );
              const promise = new Promise<AudioBuffer>((resolve, reject) =>
                     queue.push({
                            asset,
                            decode: decodeIt,
                            generation: gen,
                            resolve,
                            reject,
                     }),
              );
              pending.set(key, promise);
              void promise.then(
                     () => pending.delete(key),
                     () => pending.delete(key),
              );
              pump();
              return promise;
       };
       const request = (id: string) => {
              const data = compressed.get(id);
              if (data && !buffers.has(id)) {
                     return schedule(id, true, generation);
              }
              return schedule(id, true, generation);
       };
       return {
              request,
              async startPlan(plan, gen = generation) {
                     if (gen !== generation) return;
                     const seeds = new Set(plan.seedIds);
                     seed.clear();
                     seeds.forEach((id) => seed.add(id));
                     await Promise.allSettled(
                            plan.bootstrapIds.map((id) =>
                                   schedule(id, seeds.has(id), gen),
                            ),
                     );
                     if (plan.visible !== false && !plan.saveData) {
                            const bootstrap = new Set(plan.bootstrapIds);
                            const priority = new Set(plan.priorityIds ?? []);
                            void Promise.allSettled([
                                   ...[...priority].map((id) =>
                                          schedule(id, true, gen),
                                   ),
                                   ...manifest.assets
                                          .filter(
                                                 (asset) =>
                                                        !bootstrap.has(
                                                               asset.id,
                                                        ) &&
                                                        !priority.has(asset.id),
                                          )
                                          .map((asset) =>
                                                 schedule(asset.id, false, gen),
                                          ),
                            ]);
                     }
                     publish(gen);
              },
              subscribe(listener) {
                     listeners.add(listener);
                     listener(snapshot);
                     return () => listeners.delete(listener);
              },
              prewarm(plan, gen = generation) {
                     if (gen !== generation) return Promise.resolve();
                     return Promise.allSettled(
                            plan.map((id) => request(id)),
                     ).then(() => undefined);
              },
              cancel(gen = generation) {
                     if (gen !== generation) return;
                     generation++;
                     const old = queue.splice(0);
                     for (const job of old) job.reject(new Error("superseded"));
                     pending.clear();
                     publish();
              },
              dispose() {
                     disposed = true;
                     for (const job of queue.splice(0))
                            job.reject(new Error("loader disposed"));
                     buffers.clear();
                     compressed.clear();
                     used.clear();
                     pending.clear();
                     publish();
              },
              state: () => snapshot,
              get(id) {
                     const value = buffers.get(id);
                     if (value) used.set(id, Date.now());
                     return value;
              },
       };
}
