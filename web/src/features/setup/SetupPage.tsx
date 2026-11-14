import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { m } from "motion/react";
import { ArrowRight, Globe, Lock } from "lucide-react";
import { api, isApiError, messageFor, type AnonymousMode, type ReplyVisibility } from "../../api";
import { DEFAULT_REPLY_STYLE } from "../../api/defaults";
import { BrandName } from "../../components/brand/Brand";
import { Button } from "../../components/ui/Button";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { SegmentedControl, Switch } from "../../components/ui/Switch";
import { fadeUp, stagger } from "../../lib/motion";
import { DESCRIPTION_MAX, normalizeSlug, TITLE_MAX, validateRequired, validateSlug } from "../../lib/validation";
import { useSession } from "../../state/session";
import { useToast } from "../../state/toast";
import { BoxIdentity } from "../public-box/BoxIdentity";
import { SlugField } from "../owner/SlugField";
import { useSlugAvailability } from "../owner/useSlugAvailability";
import styles from "./SetupPage.module.css";

export function SetupPage() {
  const { session, setBox } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const user = session!.user;

  const [slug, setSlug] = useState(() => normalizeSlug(user.email.split("@")[0] ?? "").slice(0, 24));
  const [title, setTitle] = useState("问我任何事");
  const [description, setDescription] = useState("");
  const [anonymous, setAnonymous] = useState<AnonymousMode>("allowed");
  const [visibility, setVisibility] = useState<ReplyVisibility>("private");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const slugState = useSlugAvailability(slug);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = {
      slug: validateSlug(slug) ?? (slugState === "taken" ? "这个地址已经被使用了。" : null),
      title: validateRequired(title, "标题", TITLE_MAX),
      description: description.length > DESCRIPTION_MAX ? `简介最多 ${DESCRIPTION_MAX} 字。` : null,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setPending(true);
    try {
      const box = await api.createBox({
        slug,
        title: title.trim(),
        description: description.trim(),
        anonymous_mode: anonymous,
        default_reply_visibility: visibility,
        status: "active",
        reply_style: DEFAULT_REPLY_STYLE,
      });
      setBox(box);
      toast.success("提问箱已创建");
      navigate("/app/share?welcome=1", { replace: true });
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length) setErrors(error.fields);
      else toast.error(messageFor(error));
      setPending(false);
    }
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <BrandName to={null} />
        <span className={styles.step}>第 2 步，共 2 步</span>
      </header>

      <main className={styles.main}>
        <m.form
          className={styles.form}
          onSubmit={onSubmit}
          noValidate
          variants={stagger(0.05)}
          initial="initial"
          animate="animate"
        >
          <m.div variants={fadeUp}>
            <h1 className={styles.title}>设置你的提问箱</h1>
            <p className={styles.subtitle}>这些信息会出现在公开页面上，之后随时可以在设置里修改。</p>
          </m.div>

          <m.div variants={fadeUp} className={styles.fields}>
            <SlugField
              value={slug}
              onChange={(v) => {
                setSlug(v);
                setErrors((s) => ({ ...s, slug: null }));
              }}
              state={slugState}
              error={errors.slug}
              showValidation={submitted}
            />
            <Field label="标题" error={errors.title} counter={{ value: title.length, max: TITLE_MAX }}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setErrors((s) => ({ ...s, title: null }));
                  }}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
            <Field
              label="简介"
              optional
              hint="一两句话，告诉大家可以问你什么。"
              error={errors.description}
              counter={{ value: description.length, max: DESCRIPTION_MAX }}
            >
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  minRows={3}
                  maxRows={6}
                  placeholder="比如：关于设计、职业，或者生活里的小事，都可以问。"
                />
              )}
            </Field>
          </m.div>

          <m.div variants={fadeUp} className={styles.options}>
            <Switch
              checked={anonymous === "allowed"}
              onChange={(on) => setAnonymous(on ? "allowed" : "disabled")}
              label="允许匿名提问"
              description="开启后，提问者可以不留称呼。关闭则要求每位提问者留下称呼。"
            />
            <div className={styles.divider} />
            <div className={styles.option}>
              <div>
                <p className={styles.optionLabel}>默认回复方式</p>
                <p className={styles.optionHint}>每次确认回复时都可以单独调整。</p>
              </div>
              <SegmentedControl
                label="默认回复方式"
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: "private", label: "私密", icon: <Lock /> },
                  { value: "public", label: "公开", icon: <Globe /> },
                ]}
              />
            </div>
          </m.div>

          <m.div variants={fadeUp}>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={pending} trailingIcon={<ArrowRight />}>
              创建提问箱
            </Button>
          </m.div>
        </m.form>

        <aside className={styles.preview} aria-label="公开页预览">
          <p className={styles.previewLabel}>预览</p>
          <div className={styles.previewCard}>
            <BoxIdentity
              as="p"
              size="sm"
              ownerName={user.display_name}
              slug={slug || "your-link"}
              title={title.trim() || "问我任何事"}
              description={description.trim()}
            />
            <div className={styles.previewInput}>写下你想问的…</div>
            <div className={styles.previewFoot}>
              <span>{anonymous === "allowed" ? "可以匿名提问" : "需要留下称呼"}</span>
              <span className={styles.previewSend}>发送</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
