import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

interface Entry<T = unknown> {
  data?: T;
  error?: unknown;
  status: "idle" | "loading" | "success" | "error";
  promise?: Promise<void>;
  stale: boolean;
  listeners: Set<() => void>;
  snapshot: Snapshot<T>;
}

export interface Snapshot<T> {
  data: T | undefined;
  error: unknown;
  /** True only when there is nothing to show yet. */
  loading: boolean;
  /** True whenever a request is in flight, including background refreshes. */
  fetching: boolean;
}

const cache = new Map<string, Entry>();

function entryFor<T>(key: string): Entry<T> {
  let entry = cache.get(key) as Entry<T> | undefined;
  if (!entry) {
    entry = {
      status: "idle",
      stale: true,
      listeners: new Set(),
      snapshot: { data: undefined, error: undefined, loading: true, fetching: false },
    };
    cache.set(key, entry as Entry);
  }
  return entry;
}

function publish(entry: Entry) {
  entry.snapshot = {
    data: entry.data,
    error: entry.status === "error" ? entry.error : undefined,
    loading: entry.data === undefined && entry.status !== "error",
    fetching: entry.status === "loading",
  };
  entry.listeners.forEach((listener) => listener());
}

function run<T>(key: string, fetcher: () => Promise<T>): Promise<void> {
  const entry = entryFor<T>(key);
  if (entry.promise) return entry.promise;
  entry.status = "loading";
  entry.stale = false;
  publish(entry as Entry);
  const promise = fetcher().then(
    (data) => {
      entry.data = data;
      entry.error = undefined;
      entry.status = "success";
    },
    (error: unknown) => {
      entry.error = error;
      entry.status = "error";
    },
  );
  entry.promise = promise.finally(() => {
    entry.promise = undefined;
    publish(entry as Entry);
  });
  return entry.promise;
}

/** Fetch-and-cache hook. Pass `null` as key to skip fetching. */
export function useQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!key) return () => {};
      const entry = entryFor(key);
      entry.listeners.add(onChange);
      return () => entry.listeners.delete(onChange);
    },
    [key],
  );

  const snapshot = useSyncExternalStore(subscribe, () =>
    key ? (entryFor<T>(key).snapshot as Snapshot<T>) : EMPTY,
  ) as Snapshot<T>;

  useEffect(() => {
    if (!key) return;
    const entry = entryFor<T>(key);
    if (entry.stale && !entry.promise) void run(key, () => fetcherRef.current());
  }, [key, snapshot]);

  const refetch = useCallback(() => {
    if (!key) return Promise.resolve();
    entryFor(key).stale = true;
    return run(key, () => fetcherRef.current());
  }, [key]);

  return { ...snapshot, refetch };
}

const EMPTY: Snapshot<never> = { data: undefined, error: undefined, loading: false, fetching: false };

/** Mark every cached key starting with one of the prefixes as stale; mounted queries refetch. */
export function invalidate(...prefixes: string[]) {
  for (const [key, entry] of cache) {
    if (prefixes.some((p) => key.startsWith(p))) {
      entry.stale = true;
      publish(entry);
    }
  }
}

/** Synchronously update cached data, e.g. for optimistic updates. */
export function setQueryData<T>(key: string, update: (current: T | undefined) => T | undefined) {
  const entry = entryFor<T>(key);
  entry.data = update(entry.data);
  if (entry.data !== undefined && entry.status !== "loading") entry.status = "success";
  publish(entry as Entry);
}

export function updateQueries<T>(prefix: string, update: (current: T) => T) {
  for (const [key, entry] of cache) {
    if (key.startsWith(prefix) && entry.data !== undefined) {
      entry.data = update(entry.data as T);
      publish(entry);
    }
  }
}

export function clearQueries() {
  cache.clear();
}
