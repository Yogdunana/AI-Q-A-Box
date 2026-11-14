import { PageShell } from "@/components/page-shell";

export default function DeletionPage() {
  return (
    <PageShell
      title="删除请求"
      purpose="删除和导出规则尚未确认。这里还不会收集个人数据，也不会承诺已经进入法务流程。"
      actions={[{ href: "/", label: "回开屏页", secondary: true }]}
    />
  );
}
