import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AnimatePresence, m, useAnimate } from "motion/react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { api, isApiError, messageFor } from "../../api";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../api/mock/seed";
import { BrandName } from "../../components/brand/Brand";
import { Button } from "../../components/ui/Button";
import { Field, Input, PasswordInput } from "../../components/ui/Field";
import { duration, ease, fadeUp, stagger } from "../../lib/motion";
import { DISPLAY_NAME_MAX, validateEmail, validatePassword, validateRequired } from "../../lib/validation";
import { useSession } from "../../state/session";
import styles from "./AuthPages.module.css";

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <BrandName />
      </header>
      <main className={styles.main}>
        <m.div className={styles.column} variants={stagger(0.05)} initial="initial" animate="animate">
          <m.h1 className={styles.title} variants={fadeUp}>
            {title}
          </m.h1>
          <m.p className={styles.subtitle} variants={fadeUp}>
            {subtitle}
          </m.p>
          <m.div variants={fadeUp}>{children}</m.div>
          <m.p className={styles.footer} variants={fadeUp}>
            {footer}
          </m.p>
        </m.div>
      </main>
    </div>
  );
}

function FormAlert({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <m.div
          key={message}
          className={styles.alert}
          role="alert"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: duration.base, ease: ease.out }}
        >
          <div className={styles.alertInner}>
            <AlertCircle aria-hidden="true" />
            <span>{message}</span>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function useNextPath() {
  const [params] = useSearchParams();
  const next = params.get("next");
  return next && next.startsWith("/app") ? next : "/app";
}

function useShake() {
  const [scope, animate] = useAnimate<HTMLFormElement>();
  const shake = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !scope.current) return;
    void animate(scope.current, { x: [0, -6, 6, -3, 3, 0] }, { duration: 0.36, ease: "easeOut" });
  };
  return { scope, shake };
}

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const next = useNextPath();
  const { scope, shake } = useShake();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<"form" | "demo" | null>(null);

  async function attempt(credentials: { email: string; password: string }, source: "form" | "demo") {
    setPending(source);
    setFormError(null);
    try {
      await login(credentials);
      navigate(next, { replace: true });
    } catch (error) {
      setFormError(messageFor(error));
      shake();
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = { email: validateEmail(email), password: password ? null : "请填写密码。" };
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      shake();
      return;
    }
    void attempt({ email, password }, "form");
  }

  return (
    <AuthLayout
      title="欢迎回来"
      subtitle="登录后继续处理你的提问箱。"
      footer={
        <>
          还没有提问箱？<Link to="/auth/register">创建一个</Link>
        </>
      }
    >
      <form ref={scope} className={styles.form} onSubmit={onSubmit} noValidate>
        <FormAlert message={formError} />
        <Field label="邮箱" error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((s) => ({ ...s, email: null }));
              }}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="you@example.com"
            />
          )}
        </Field>
        <Field label="密码" error={errors.password}>
          {({ id, describedBy, invalid }) => (
            <PasswordInput
              id={id}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((s) => ({ ...s, password: null }));
              }}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={pending === "form"} disabled={pending === "demo"}>
          登录
        </Button>
      </form>

      {api.mode === "mock" && (
        <div className={styles.demo}>
          <div className={styles.divider}>
            <span>或者</span>
          </div>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={pending === "demo"}
            disabled={pending === "form"}
            onClick={() => attempt({ email: DEMO_EMAIL, password: DEMO_PASSWORD }, "demo")}
            trailingIcon={<ArrowRight />}
          >
            使用演示账号体验
          </Button>
          <p className={styles.demoHint}>演示数据只保存在当前浏览器中。</p>
        </div>
      )}
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register } = useSession();
  const navigate = useNavigate();
  const { scope, shake } = useShake();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = {
      display_name: validateRequired(name, "名字", DISPLAY_NAME_MAX),
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      shake();
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await register({ display_name: name, email, password });
      navigate("/app/setup", { replace: true });
    } catch (error) {
      if (isApiError(error) && Object.keys(error.fields).length) setErrors(error.fields);
      else setFormError(messageFor(error));
      shake();
      setPending(false);
    }
  }

  const clear = (key: string) => errors[key] && setErrors((s) => ({ ...s, [key]: null }));

  return (
    <AuthLayout
      title="创建你的提问箱"
      subtitle="先建立账户，下一步设置你的专属链接。"
      footer={
        <>
          已经有账户了？<Link to="/auth/login">登录</Link>
        </>
      }
    >
      <form ref={scope} className={styles.form} onSubmit={onSubmit} noValidate>
        <FormAlert message={formError} />
        <Field label="你的名字" hint="会显示在你的提问箱页面上。" error={errors.display_name}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              autoComplete="nickname"
              value={name}
              maxLength={DISPLAY_NAME_MAX + 8}
              onChange={(e) => {
                setName(e.target.value);
                clear("display_name");
              }}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Field label="邮箱" error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clear("email");
              }}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="you@example.com"
            />
          )}
        </Field>
        <Field label="密码" hint="至少 8 位。" error={errors.password}>
          {({ id, describedBy, invalid }) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clear("password");
              }}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={pending} trailingIcon={<ArrowRight />}>
          继续
        </Button>
      </form>
    </AuthLayout>
  );
}
