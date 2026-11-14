import { Check, X } from "lucide-react";
import { Field, Input } from "../../components/ui/Field";
import { Spinner } from "../../components/ui/Spinner";
import { displayHost } from "../../lib/format";
import { normalizeSlug, SLUG_MAX, validateSlug } from "../../lib/validation";
import type { SlugState } from "./useSlugAvailability";
import styles from "./SlugField.module.css";

interface SlugFieldProps {
  value: string;
  onChange(value: string): void;
  state: SlugState;
  error?: string | null;
  showValidation: boolean;
}

export function SlugField({ value, onChange, state, error, showValidation }: SlugFieldProps) {
  const validation = showValidation || value.length >= 3 ? validateSlug(value) : null;
  const message = error ?? validation ?? (state === "taken" ? "这个地址已经被使用了。" : null);
  const hint =
    state === "available" ? (
      <span className={styles.ok}>可以使用</span>
    ) : (
      "小写字母、数字和连字符。之后也可以修改，但旧链接会失效。"
    );

  return (
    <Field label="链接地址" hint={hint} error={message}>
      {({ id, describedBy, invalid }) => (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(normalizeSlug(e.target.value).slice(0, SLUG_MAX))}
          aria-describedby={describedBy}
          invalid={invalid}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          leading={<span className={styles.host}>{displayHost()}/</span>}
          trailing={<SlugStatus state={state} />}
        />
      )}
    </Field>
  );
}

function SlugStatus({ state }: { state: SlugState }) {
  if (state === "checking") {
    return (
      <span className={styles.status} aria-label="正在检查">
        <Spinner size={14} />
      </span>
    );
  }
  if (state === "available") {
    return (
      <span className={styles.status} data-tone="ok" aria-label="可以使用">
        <Check />
      </span>
    );
  }
  if (state === "taken") {
    return (
      <span className={styles.status} data-tone="bad" aria-label="已被使用">
        <X />
      </span>
    );
  }
  return null;
}
