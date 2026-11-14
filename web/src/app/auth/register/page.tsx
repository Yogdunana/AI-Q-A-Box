import { PageShell } from "@/components/page-shell";

export default function RegisterPage() {
  return (
    <PageShell
      title="创建提问箱"
      purpose="注册入口先留在这里。认证供应商确定之前，不会创建真正的箱主账户。"
      actions={[
        { href: "/auth/login", label: "已有账户，去登录", secondary: true },
        { href: "/app", label: "查看工作台骨架", secondary: true },
      ]}
    />
  );
}
