import { PageShell } from "@/components/page-shell";

export default function TermsPage() {
  return (
    <PageShell
      title="使用条款"
      purpose="正式条款尚未由产品方确认。本页只标出入口。"
      actions={[{ href: "/", label: "回开屏页", secondary: true }]}
    />
  );
}
