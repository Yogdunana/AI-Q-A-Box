import { PageShell } from "@/components/page-shell";

export default function HomePage() {
  return (
    <PageShell
      title={'Ask "Me"'}
      purpose="一个留给问题和回复的安静入口。"
      actions={[
        { href: "/auth/register", label: "创建我的提问箱" },
        { href: "/auth/login", label: "登录", secondary: true },
      ]}
      showLogoSlot
    />
  );
}
