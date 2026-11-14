import { PageShell } from "@/components/page-shell";

export default function PrivacyPage() {
  return (
    <PageShell
      title="隐私政策"
      purpose="适用法律、保存期限和导出权利都还没有产品方确认。本页不写这些承诺。"
      actions={[{ href: "/", label: "回开屏页", secondary: true }]}
    />
  );
}
