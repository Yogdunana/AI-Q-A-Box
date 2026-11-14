import { PageShell } from "@/components/page-shell";

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell
      title={`问题 ${id}`}
      purpose="原问题和回复草稿会分开显示。模型供应商确定之前，不会向外发送问题。"
      notes={["草稿不会自动发出，也不会自动公开。"]}
      actions={[{ href: "/app/inbox", label: "返回收件箱", secondary: true }]}
    />
  );
}
