import { PageShell } from "@/components/page-shell";

export default function WorkspacePage() {
  return (
    <PageShell
      title="工作台"
      purpose="以后这里显示待处理数量和分享入口。现在还没有箱主数据。"
      actions={[
        { href: "/app/inbox", label: "收件箱" },
        { href: "/app/share", label: "分享", secondary: true },
        { href: "/app/settings", label: "设置", secondary: true },
      ]}
    />
  );
}
