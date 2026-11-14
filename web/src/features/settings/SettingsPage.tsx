import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, m } from "motion/react";
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
} from "../../api";
import { Card, Page, PageHeader, Section } from "../../components/layout/Page";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/Dialog";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { SegmentedControl, Switch } from "../../components/ui/Switch";
import { useBeforeUnload } from "../../lib/hooks";
import { duration, ease, fadeUp, stagger } from "../../lib/motion";
import { clearQueries } from "../../lib/query";
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
import styles from "./SettingsPage.module.css";

interface FormState {
  displayName: string;
  box: Omit<BoxInput, "reply_style">;
  style: ReplyStyle;
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

export function SettingsPage() {
  const { user, box } = useOwner();
  const { setBox, setUser, logout } = useSession();
  const toast = useToast();
  const navigate = useNavigate();

  const initial = useMemo<FormState>(
    () => ({
      displayName: user.display_name,
      box: {
        slug: box.slug,
        title: box.title,
        description: box.description,
        anonymous_mode: box.anonymous_mode,
        default_reply_visibility: box.default_reply_visibility,
        status: box.status,
      },
      style: box.reply_style,
    }),
    [user, box],
  );

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const slugState = useSlugAvailability(form.box.slug, box.slug);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useBeforeUnload(dirty);

  const setBoxField = <K extends keyof FormState["box"]>(key: K, value: FormState["box"][K]) => {
    setForm((f) => ({ ...f, box: { ...f.box, [key]: value } }));
    setErrors((e) => ({ ...e, [key]: null }));
  };
  const setStyle = <K extends keyof ReplyStyle>(key: K, value: ReplyStyle[K]) =>
    setForm((f) => ({ ...f, style: { ...f.style, [key]: value } }));

  async function save() {
    const nextErrors = {
      display_name: validateRequired(form.displayName, "显示名称", DISPLAY_NAME_MAX),
      title: validateRequired(form.box.title, "标题", TITLE_MAX),
      description: form.box.description.length > DESCRIPTION_MAX ? `简介最多 ${DESCRIPTION_MAX} 字。` : null,
      slug: validateSlug(form.box.slug) ?? (slugState === "taken" ? "这个地址已经被使用了。" : null),
      notes: form.style.notes.length > STYLE_NOTES_MAX ? `最多 ${STYLE_NOTES_MAX} 字。` : null,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      toast.error("有几项需要修改，请检查标红的内容。");
      return;
    }

    setSaving(true);
    try {
      if (form.displayName.trim() !== user.display_name) {
        setUser(await api.updateProfile({ display_name: form.displayName.trim() }));
      }
      const boxChanged =
        JSON.stringify(form.box) !== JSON.stringify(initial.box) ||
        JSON.stringify(form.style) !== JSON.stringify(initial.style);
      if (boxChanged) {
        const updated = await api.updateBox(box.id, {
          ...form.box,
          title: form.box.title.trim(),
          description: form.box.description.trim(),
          reply_style: { ...form.style, notes: form.style.notes.trim() },
        });
        setBox(updated);
        setForm((f) => ({ ...f, box: { ...f.box, title: updated.title, description: updated.description }, style: updated.reply_style }));
      }
      toast.success("设置已保存");
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length) setErrors(error.fields);
      toast.error(messageFor(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page width="narrow" className={styles.page}>
      <PageHeader title="设置" description="管理你的资料、提问箱和 AI 回复风格。" />

      <m.div className={styles.sections} variants={stagger(0.05)} initial="initial" animate="animate">
        <m.div variants={fadeUp}>
          <Section title="个人资料" id="profile">
            <Card className={styles.stack}>
              <Field label="显示名称" error={errors.display_name} hint="提问者会在你的公开页面上看到它。">
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    value={form.displayName}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, displayName: e.target.value }));
                      setErrors((s) => ({ ...s, display_name: null }));
                    }}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
              <Field label="邮箱" hint="用于登录，不会公开。">
                {({ id, describedBy }) => <Input id={id} value={user.email} readOnly aria-describedby={describedBy} />}
              </Field>
            </Card>
          </Section>
        </m.div>

        <m.div variants={fadeUp}>
          <Section title="提问箱" id="box">
            <Card className={styles.stack}>
              <Field label="标题" error={errors.title} counter={{ value: form.box.title.length, max: TITLE_MAX }}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    value={form.box.title}
                    onChange={(e) => setBoxField("title", e.target.value)}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
              <Field
                label="简介"
                optional
                error={errors.description}
                counter={{ value: form.box.description.length, max: DESCRIPTION_MAX }}
              >
                {({ id, describedBy, invalid }) => (
                  <Textarea
                    id={id}
                    value={form.box.description}
                    onChange={(e) => setBoxField("description", e.target.value)}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    minRows={2}
                    maxRows={6}
                  />
                )}
              </Field>
              <SlugField
                value={form.box.slug}
                onChange={(v) => setBoxField("slug", v)}
                state={slugState}
                error={errors.slug}
                showValidation
              />
              <div className={styles.divider} />
              <Switch
                checked={form.box.status === "active"}
                onChange={(on) => setBoxField("status", on ? "active" : "paused")}
                label="接收新问题"
                description="关闭后，访客仍能打开页面，但无法提交新问题。"
              />
              <Switch
                checked={form.box.anonymous_mode === "allowed"}
                onChange={(on) => setBoxField("anonymous_mode", on ? "allowed" : "disabled")}
                label="允许匿名提问"
                description="关闭后，每位提问者都需要留下称呼。"
              />
              <div className={styles.row}>
                <div>
                  <p className={styles.rowLabel}>默认回复方式</p>
                  <p className={styles.rowHint}>每次确认回复时仍可单独调整。</p>
                </div>
                <SegmentedControl
                  label="默认回复方式"
                  value={form.box.default_reply_visibility}
                  onChange={(v) => setBoxField("default_reply_visibility", v)}
                  options={[
                    { value: "private", label: "私密", icon: <Lock /> },
                    { value: "public", label: "公开", icon: <Globe /> },
                  ]}
                />
              </div>
            </Card>
          </Section>
        </m.div>

        <m.div variants={fadeUp}>
          <Section
            title="AI 回复风格"
            id="style"
            description="生成草稿时，只会参考这里保存的设置和当前这条问题。"
          >
            <Card className={styles.stack}>
              <div className={styles.row}>
                <p className={styles.rowLabel}>语气</p>
                <SegmentedControl label="语气" value={form.style.tone} onChange={(v) => setStyle("tone", v)} options={TONES} />
              </div>
              <div className={styles.row}>
                <p className={styles.rowLabel}>篇幅</p>
                <SegmentedControl label="篇幅" value={form.style.length} onChange={(v) => setStyle("length", v)} options={LENGTHS} />
              </div>
              <div className={styles.row}>
                <p className={styles.rowLabel}>语言</p>
                <SegmentedControl
                  label="语言"
                  value={form.style.language}
                  onChange={(v) => setStyle("language", v)}
                  options={LANGUAGES}
                />
              </div>
              <div className={styles.divider} />
              <Field
                label="关于你"
                optional
                hint="写下你的身份、经历和说话习惯。AI 只会参考这里的内容，不会编造你没写过的事。"
                error={errors.notes}
                counter={{ value: form.style.notes.length, max: STYLE_NOTES_MAX }}
              >
                {({ id, describedBy, invalid }) => (
                  <Textarea
                    id={id}
                    value={form.style.notes}
                    onChange={(e) => setStyle("notes", e.target.value)}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    minRows={4}
                    maxRows={10}
                    placeholder="比如：我是独立设计师，做过五年 B 端产品。回答尽量简短真诚，不说空话。"
                  />
                )}
              </Field>
            </Card>
          </Section>
        </m.div>

        <m.div variants={fadeUp}>
          <Section title="账户" id="account">
            <Card className={styles.stack}>
              <div className={styles.row}>
                <div>
                  <p className={styles.rowLabel}>退出登录</p>
                  <p className={styles.rowHint}>在这台设备上退出你的账户。</p>
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
                  <div className={styles.row}>
                    <div>
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
          </Section>
        </m.div>
      </m.div>

      <AnimatePresence>
        {dirty && (
          <m.div
            className={styles.saveBar}
            role="region"
            aria-label="保存更改"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } }}
            exit={{ opacity: 0, y: 24, transition: { duration: duration.fast, ease: ease.in } }}
          >
            <span className={styles.saveText}>有未保存的更改</span>
            <div className={styles.saveActions}>
              <Button
                variant="ghost"
                size="sm"
                className={styles.discard}
                onClick={() => {
                  setForm(initial);
                  setErrors({});
                }}
                disabled={saving}
              >
                放弃
              </Button>
              <Button variant="accent" size="sm" onClick={save} loading={saving}>
                保存更改
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

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
    </Page>
  );
}
