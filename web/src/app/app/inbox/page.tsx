import { PageShell } from "@/components/page-shell";

export default function InboxPage() {
  return (
    <PageShell
      title="收件箱"
      purpose="桌面端会分成筛选、列表和详情。小屏会改成单列。列表尚未接入。"
      actions={[{ href: "/app/questions/preview", label: "查看问题详情占位", secondary: true }]}
    />
  );
}
