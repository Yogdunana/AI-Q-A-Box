import { PageShell } from "@/components/page-shell";

export default function LoginPage() {
  return (
    <PageShell
      title="登录"
      purpose="认证方式还没有选定，所以这里先不接入外部登录，也不收集密码。"
      actions={[
        { href: "/auth/register", label: "去注册", secondary: true },
        { href: "/", label: "回开屏页", secondary: true },
      ]}
    />
  );
}
