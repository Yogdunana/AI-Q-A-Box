import { useEffect, useState } from "react";
import { api, isApiError } from "../../api";
import { useDebouncedValue } from "../../lib/hooks";
import { validateSlug } from "../../lib/validation";

export type SlugState = "idle" | "checking" | "available" | "taken" | "invalid" | "unknown";

/**
 * Availability is checked against the public box endpoint (404 = free). The
 * server still enforces uniqueness on save; this is only early feedback.
 */
export function useSlugAvailability(slug: string, current?: string): SlugState {
  const debounced = useDebouncedValue(slug, 380);
  const [result, setResult] = useState<{ slug: string; state: SlugState }>({ slug: "", state: "idle" });

  useEffect(() => {
    if (!debounced || validateSlug(debounced) || debounced === current) return;
    let cancelled = false;
    api.getPublicBox(debounced).then(
      () => !cancelled && setResult({ slug: debounced, state: "taken" }),
      (error) => {
        if (cancelled) return;
        setResult({ slug: debounced, state: isApiError(error, "not_found") ? "available" : "unknown" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [debounced, current]);

  if (!slug) return "idle";
  if (validateSlug(slug)) return "invalid";
  if (slug === current) return "idle";
  if (slug !== debounced || result.slug !== slug) return "checking";
  return result.state;
}
