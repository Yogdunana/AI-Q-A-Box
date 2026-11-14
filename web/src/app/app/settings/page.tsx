import { PageShell } from "@/components/page-shell";

export default function SettingsPage() {
  return (
    <PageShell
      title="设置"
      purpose="以后可以编辑资料、提问箱文案和 slug。匿名与默认可见性仍待产品确认，现在不会生效。"
      actions={[{ href: "/app", label: "返回工作台", secondary: true }]}
    />
  );
}
