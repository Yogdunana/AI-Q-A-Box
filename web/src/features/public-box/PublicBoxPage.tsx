import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AnimatePresence, m } from "motion/react";
import { AlertCircle, ArrowUp, Lock, PauseCircle, RefreshCw, SearchX } from "lucide-react";
import { api, isApiError, messageFor, type PublicBox } from "../../api";
import { BrandName, PRODUCT_NAME } from "../../components/brand/Brand";
import { Button, ButtonLink } from "../../components/ui/Button";
import { EmptyState, Kbd, Skeleton } from "../../components/ui/Display";
import { Counter, Field, Input, Textarea } from "../../components/ui/Field";
import { Switch } from "../../components/ui/Switch";
import { features } from "../../config/features";
import { duration, ease, fadeUp, stagger } from "../../lib/motion";
import { useQuery } from "../../lib/query";
import { NICKNAME_MAX, QUESTION_MAX, validateQuestion } from "../../lib/validation";
import { BoxIdentity } from "./BoxIdentity";
import { PublicAnswers } from "./PublicAnswers";
import styles from "./PublicBoxPage.module.css";

export function PublicBoxPage() {
  const { slug = "" } = useParams();
  const { data: box, error, loading, refetch } = useQuery(`public:box:${slug}`, () => api.getPublicBox(slug));

  useEffect(() => {
    if (box) document.title = `${box.title} · ${box.owner.display_name} · ${PRODUCT_NAME}`;
    return () => {
      document.title = PRODUCT_NAME;
    };
  }, [box]);

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <BrandName size="sm" />
      </header>

      <main className={styles.main}>
        {loading ? (
          <PublicSkeleton />
        ) : error ? (
          isApiError(error, "not_found") ? (
            <EmptyState
              icon={<SearchX />}
              title="找不到这个提问箱"
              body="链接可能有误，或者这个提问箱已经不再开放。"
              actions={
                <ButtonLink to="/" variant="secondary">
                  回到首页
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={<AlertCircle />}
              tone="danger"
              title="页面没能加载出来"
              body={messageFor(error)}
              actions={
                <Button variant="primary" leadingIcon={<RefreshCw />} onClick={() => void refetch()}>
                  重试
                </Button>
              }
            />
          )
        ) : box ? (
          <m.div variants={stagger(0.06)} initial="initial" animate="animate">
            <m.div variants={fadeUp}>
              <BoxIdentity
                ownerName={box.owner.display_name}
                avatarUrl={box.owner.avatar_url}
                slug={box.slug}
                title={box.title}
                description={box.description}
              />
            </m.div>
            <m.div variants={fadeUp} className={styles.composerWrap}>
              {box.accepting ? <Composer box={box} /> : <PausedNotice name={box.owner.display_name} />}
            </m.div>
            {features.publicAnswers && (
              <m.div variants={fadeUp}>
                <PublicAnswers slug={box.slug} ownerName={box.owner.display_name} />
              </m.div>
            )}
          </m.div>
        ) : null}
      </main>

      <footer className={styles.footer}>
        <Link to="/" className={styles.footerLink}>
          {PRODUCT_NAME} · 创建你自己的提问箱
        </Link>
      </footer>
    </div>
  );
}

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function Composer({ box }: { box: PublicBox }) {
  const navigate = useNavigate();
  const anonymousAllowed = box.anonymous_mode === "allowed";
  const [content, setContent] = useState("");
  const [anonymous, setAnonymous] = useState(anonymousAllowed);
  const [nickname, setNickname] = useState("");
  const [touched, setTouched] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const idempotencyKey = useRef(newKey());
  const lastSubmitted = useRef("");

  const contentError = touched ? validateQuestion(content) : null;
  const canSubmit = !validateQuestion(content) && (anonymous || nickname.trim().length > 0) && !pending;
  const showCounter = content.length > QUESTION_MAX * 0.7;

  async function submit() {
    setTouched(true);
    if (validateQuestion(content)) return;
    if (!anonymous && !nickname.trim()) {
      setNicknameError("请留下一个称呼。");
      return;
    }
    if (content !== lastSubmitted.current) {
      idempotencyKey.current = newKey();
      lastSubmitted.current = content;
    }
    setPending(true);
    setFormError(null);
    try {
      await api.submitQuestion(box.slug, {
        content: content.trim(),
        is_anonymous: anonymous,
        asker_display_name: anonymous ? undefined : nickname.trim(),
        idempotency_key: idempotencyKey.current,
      });
      navigate(`/${box.slug}/submitted`, {
        state: { question: content.trim(), ownerName: box.owner.display_name },
      });
    } catch (error) {
      if (isApiError(error) && error.fields.asker_display_name) setNicknameError(error.fields.asker_display_name);
      else setFormError(messageFor(error));
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form className={styles.composer} onSubmit={onSubmit} noValidate aria-label={`向 ${box.owner.display_name} 提问`}>
      <div className={styles.writing} data-invalid={Boolean(contentError) || undefined}>
        <label htmlFor="question" className="visually-hidden">
          你的问题
        </label>
        <Textarea
          id="question"
          className={styles.questionInput}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (formError) setFormError(null);
          }}
          onBlur={() => content && setTouched(true)}
          onKeyDown={onKeyDown}
          placeholder={`写下你想问 ${box.owner.display_name} 的问题…`}
          minRows={4}
          maxRows={12}
          aria-describedby="question-meta"
          invalid={Boolean(contentError)}
        />
        <div id="question-meta" className={styles.writingMeta}>
          <AnimatePresence initial={false} mode="wait">
            {contentError ? (
              <m.span
                key="error"
                className={styles.inlineError}
                role="alert"
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.fast }}
              >
                {contentError}
              </m.span>
            ) : (
              <m.span key="hint" className={styles.shortcut} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Kbd>{navigator.platform?.includes("Mac") ? "⌘" : "Ctrl"}</Kbd>
                <Kbd>Enter</Kbd>
                <span>发送</span>
              </m.span>
            )}
          </AnimatePresence>
          {showCounter && <Counter value={content.length} max={QUESTION_MAX} />}
        </div>
      </div>

      <div className={styles.identity}>
        {anonymousAllowed && (
          <Switch
            checked={anonymous}
            onChange={(on) => {
              setAnonymous(on);
              setNicknameError(null);
            }}
            label="匿名提问"
            description={anonymous ? "箱主不会看到你的称呼。" : "箱主会看到你留下的称呼。"}
          />
        )}
        <AnimatePresence initial={false}>
          {!anonymous && (
            <m.div
              key="nickname"
              className={styles.nicknameWrap}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: duration.base, ease: ease.out }}
            >
              <Field
                label="你的称呼"
                hint={anonymousAllowed ? undefined : `${box.owner.display_name} 希望知道是谁在提问。`}
                error={nicknameError}
                className={styles.nicknameField}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    value={nickname}
                    maxLength={NICKNAME_MAX}
                    autoComplete="nickname"
                    onChange={(e) => {
                      setNickname(e.target.value);
                      setNicknameError(null);
                    }}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    placeholder="怎么称呼你"
                  />
                )}
              </Field>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {formError && (
          <m.div
            key="form-error"
            className={styles.formError}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
          >
            <div className={styles.formErrorInner}>
              <AlertCircle aria-hidden="true" />
              <span>{formError} 你写的内容还在。</span>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <div className={styles.actions}>
        <p className={styles.privacy}>
          <Lock aria-hidden="true" />
          <span>
            只有 {box.owner.display_name} 能看到你的问题。{anonymous ? "匿名指对箱主隐藏身份，平台仍会保留防滥用所需的最少技术记录。" : ""}
          </span>
        </p>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          loading={pending}
          aria-disabled={(!canSubmit && !pending) || undefined}
          trailingIcon={<ArrowUp />}
          className={styles.submit}
        >
          发送问题
        </Button>
      </div>
    </form>
  );
}

function PausedNotice({ name }: { name: string }) {
  return (
    <div className={styles.paused} role="status">
      <PauseCircle aria-hidden="true" />
      <div>
        <p className={styles.pausedTitle}>暂时不接收新问题</p>
        <p className={styles.pausedBody}>{name} 暂停了这个提问箱，过段时间再来看看吧。</p>
      </div>
    </div>
  );
}

function PublicSkeleton() {
  return (
    <div aria-busy="true" aria-label="加载中">
      <div className={styles.skeletonOwner}>
        <Skeleton width={44} height={44} radius={22} />
        <div className={styles.skeletonOwnerText}>
          <Skeleton width={96} height={14} />
          <Skeleton width={64} height={12} />
        </div>
      </div>
      <Skeleton width="62%" height={36} style={{ marginTop: 28 }} />
      <Skeleton width="88%" height={14} style={{ marginTop: 18 }} />
      <Skeleton width="54%" height={14} style={{ marginTop: 10 }} />
      <Skeleton width="100%" height={220} radius={20} style={{ marginTop: 32 }} />
    </div>
  );
}
