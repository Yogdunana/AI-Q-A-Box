import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Globe, Lock, LogOut, RotateCcw } from "lucide-react";
import {
  api,
  isApiError,
  messageFor,
  resetMockData,
  type BoxInput,
  type ReplyLanguage,
  type ReplyLength,
  type ReplyStyle,
  type ReplyTone,
  type ReplyVisibility,
} from "../../api";
import { Card } from "../../components/layout/Page";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/Dialog";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { SegmentedControl, Switch } from "../../components/ui/Switch";
import { clearQueries, useQuery } from "../../lib/query";
import {
  DESCRIPTION_MAX,
  DISPLAY_NAME_MAX,
  STYLE_NOTES_MAX,
  TITLE_MAX,
  validateRequired,
  validateSlug,
} from "../../lib/validation";
import { useOwner, useSession } from "../../state/session";
import { useToast } from "../../state/toast";
import { SlugField } from "../owner/SlugField";
import { useSlugAvailability } from "../owner/useSlugAvailability";
import { SettingsFrame } from "./SettingsFrame";
import styles from "./Settings.module.css";

type Errors = Record<string, string | null>;

function useForm<T extends object>(initial: T) {
  const [form, setForm] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  if (baseline !== initial) {
    setBaseline(initial);
    setForm(initial);
  }
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key as string]: null }));
  };
  const reset = () => {
    setForm(initial);
    setErrors({});
  };
  return { form, set, dirty, reset, errors, setErrors };
}

function useSaver() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  async function run(task: () => Promise<void>, onFieldErrors?: (fields: Errors) => void) {
    setSaving(true);
    try {
      await task();
      toast.success("设置已保存");
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length) onFieldErrors?.(error.fields);
      toast.error(messageFor(error));
    } finally {
      setSaving(false);
    }
  }
  return { saving, run };
}

export function ProfileSection() {
  const { user } = useOwner();
  const { setUser } = useSession();
  const initial = useMemo(() => ({ display_name: user.display_name }), [user]);
  const { form, set, dirty, reset, errors, setErrors } = useForm(initial);
  const { saving, run } = useSaver();

  function save() {
    const error = validateRequired(form.display_name, "显示名称", DISPLAY_NAME_MAX);
    if (error) return setErrors({ display_name: error });
    void run(async () => setUser(await api.updateProfile({ display_name: form.display_name.trim() })), setErrors);
  }

  return (
    <SettingsFrame title="个人资料" description="提问者会在你的公开页面上看到这些信息。" dirty={dirty} saving={saving} onSave={save} onDiscard={reset}>
      <Card className={styles.stack}>
        <Field label="显示名称" error={errors.display_name}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              value={form.display_name}
              onChange={(e) => set("display_name", e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="nickname"
            />
          )}
        </Field>
        <Field label="邮箱" hint="用于登录，不会公开。">
          {({ id, describedBy }) => <Input id={id} value={user.email} readOnly aria-describedby={describedBy} />}
        </Field>
      </Card>
    </SettingsFrame>
  );
}

type BoxForm = Omit<BoxInput, "reply_style">;

export function BoxSection() {
  const { box } = useOwner();
  const { setBox } = useSession();
  const initial = useMemo<BoxForm>(
    () => ({
      slug: box.slug,
      title: box.title,
      description: box.description,
      anonymous_mode: box.anonymous_mode,
      default_reply_visibility: box.default_reply_visibility,
      status: box.status,
    }),
    [box],
  );
  const { form, set, dirty, reset, errors, setErrors } = useForm(initial);
  const { saving, run } = useSaver();
  const slugState = useSlugAvailability(form.slug, box.slug);

  function save() {
    const next = {
      title: validateRequired(form.title, "标题", TITLE_MAX),
      description: form.description.length > DESCRIPTION_MAX ? `简介最多 ${DESCRIPTION_MAX} 字。` : null,
      slug: validateSlug(form.slug) ?? (slugState === "taken" ? "这个地址已经被使用了。" : null),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    void run(
      async () => setBox(await api.updateBox(box.id, { ...form, title: form.title.trim(), description: form.description.trim() })),
      setErrors,
    );
  }

  return (
    <SettingsFrame title="提问箱" description="公开页面的内容，以及访客如何向你提问。" dirty={dirty} saving={saving} onSave={save} onDiscard={reset}>
      <Card className={styles.stack}>
        <Field label="标题" error={errors.title} counter={{ value: form.title.length, max: TITLE_MAX }}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} value={form.title} onChange={(e) => set("title", e.target.value)} aria-describedby={describedBy} invalid={invalid} />
          )}
        </Field>
        <Field label="简介" optional error={errors.description} counter={{ value: form.description.length, max: DESCRIPTION_MAX }}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              minRows={2}
              maxRows={6}
            />
          )}
        </Field>
        <SlugField value={form.slug} onChange={(v) => set("slug", v)} state={slugState} error={errors.slug} showValidation />
      </Card>

      <Card className={styles.stack}>
        <Switch
          checked={form.status === "active"}
          onChange={(on) => set("status", on ? "active" : "paused")}
          label="接收新问题"
          description="关闭后，访客仍能打开页面，但无法提交新问题。"
        />
        <div className={styles.divider} />
        <Switch
          checked={form.anonymous_mode === "allowed"}
          onChange={(on) => set("anonymous_mode", on ? "allowed" : "disabled")}
          label="允许匿名提问"
          description="关闭后，每位提问者都需要留下称呼。匿名只对箱主隐藏称呼，平台仍保留防滥用所需的最少记录。"
        />
        <div className={styles.divider} />
        <PublicReplySetting
          value={form.default_reply_visibility}
          onChange={(value) => set("default_reply_visibility", value)}
        />
      </Card>
    </SettingsFrame>
  );
}

function PublicReplySetting({
  value,
  onChange,
}: {
  value: ReplyVisibility;
  onChange(value: ReplyVisibility): void;
}) {
  const { data } = useQuery("capabilities", () => api.getCapabilities());
  if (!data?.public_replies_enabled) {
    return (
      <div>
        <p className={styles.rowLabel}>回复方式</p>
        <p className={styles.rowHint}>
          公开发布目前关闭。确认后的回复只通过提问者的查看链接可见。以后如果开放公开，也必须由提问者在提交时明确同意，不能只靠箱主确认。
        </p>
      </div>
    );
  }
  return (
    <div className={styles.row2}>
      <div>
        <p className={styles.rowLabel}>默认回复方式</p>
        <p className={styles.rowHint}>公开需要提问者在提交时明确同意。没有同意的问题不能公开。</p>
      </div>
      <SegmentedControl
        label="默认回复方式"
        value={value}
        onChange={onChange}
        options={[
          { value: "private", label: "私密", icon: <Lock /> },
          { value: "public", label: "公开", icon: <Globe /> },
        ]}
      />
    </div>
  );
}

const TONES: Array<{ value: ReplyTone; label: string }> = [
  { value: "warm", label: "温和" },
  { value: "direct", label: "直接" },
  { value: "playful", label: "轻松" },
  { value: "professional", label: "专业" },
];

const LENGTHS: Array<{ value: ReplyLength; label: string }> = [
  { value: "short", label: "简短" },
  { value: "medium", label: "适中" },
  { value: "long", label: "详细" },
];

const LANGUAGES: Array<{ value: ReplyLanguage; label: string }> = [
  { value: "auto", label: "跟随提问" },
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
];

export function StyleSection() {
  const { box } = useOwner();
  const { setBox } = useSession();
  const initial = useMemo<ReplyStyle>(() => box.reply_style, [box]);
  const { form, set, dirty, reset, errors, setErrors } = useForm(initial);
  const { saving, run } = useSaver();

  function save() {
    if (form.notes.length > STYLE_NOTES_MAX) return setErrors({ notes: `最多 ${STYLE_NOTES_MAX} 字。` });
    void run(async () => setBox(await api.updateBox(box.id, { reply_style: { ...form, notes: form.notes.trim() } })), setErrors);
  }

  return (
    <SettingsFrame
      title="AI 回复风格"
      description="生成草稿时，只会参考这里保存的设置和当前这条问题。"
      dirty={dirty}
      saving={saving}
      onSave={save}
      onDiscard={reset}
    >
      <Card className={styles.stack}>
        <div className={styles.row2}>
          <p className={styles.rowLabel}>语气</p>
          <SegmentedControl label="语气" value={form.tone} onChange={(v) => set("tone", v)} options={TONES} />
        </div>
        <div className={styles.row2}>
          <p className={styles.rowLabel}>篇幅</p>
          <SegmentedControl label="篇幅" value={form.length} onChange={(v) => set("length", v)} options={LENGTHS} />
        </div>
        <div className={styles.row2}>
          <p className={styles.rowLabel}>语言</p>
          <SegmentedControl label="语言" value={form.language} onChange={(v) => set("language", v)} options={LANGUAGES} />
        </div>
      </Card>
      <Card>
        <Field
          label="关于你"
          optional
          hint="写下你的身份、经历和说话习惯。生成草稿时会参考这些内容和当前问题。模型仍可能说错，发出前需要你自己确认。"
          error={errors.notes}
          counter={{ value: form.notes.length, max: STYLE_NOTES_MAX }}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
              minRows={4}
              maxRows={10}
              placeholder="比如：我是独立设计师，做过五年 B 端产品。回答尽量简短真诚，不说空话。"
            />
          )}
        </Field>
      </Card>
    </SettingsFrame>
  );
}

export function AccountSection() {
  const { user } = useOwner();
  const { logout } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <SettingsFrame title="账户与数据">
      <Card className={styles.stack}>
        <div className={styles.row2}>
          <div className={styles.rowTextBlock}>
            <p className={styles.rowLabel}>退出登录</p>
            <p className={styles.rowHint}>在这台设备上退出 {user.email}。</p>
          </div>
          <Button
            variant="secondary"
            leadingIcon={<LogOut />}
            onClick={async () => {
              try {
                await logout();
                navigate("/", { replace: true });
              } catch (error) {
                toast.error(messageFor(error));
              }
            }}
          >
            退出登录
          </Button>
        </div>
        {api.mode === "mock" && (
          <>
            <div className={styles.divider} />
            <div className={styles.row2}>
              <div className={styles.rowTextBlock}>
                <p className={styles.rowLabel}>重置演示数据</p>
                <p className={styles.rowHint}>清空这个浏览器里的演示数据，恢复成初始示例。</p>
              </div>
              <Button variant="secondary" leadingIcon={<RotateCcw />} onClick={() => setConfirmReset(true)}>
                重置
              </Button>
            </div>
          </>
        )}
      </Card>
      <ConfirmDialog
        open={confirmReset}
        title="重置演示数据？"
        description="这个浏览器里所有的演示账户、问题和回复都会被清空，并恢复成初始示例。"
        confirmLabel="重置"
        variant="danger"
        onConfirm={() => {
          resetMockData();
          clearQueries();
          window.location.assign("/");
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </SettingsFrame>
  );
}
