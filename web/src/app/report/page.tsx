import { PageShell } from "@/components/page-shell";

export default function ReportPage() {
  return (
    <PageShell
      title="举报"
      purpose="举报表单和审计日志会在后续任务接入。现在还不能提交举报。"
      actions={[{ href: "/", label: "回开屏页", secondary: true }]}
    />
  );
}