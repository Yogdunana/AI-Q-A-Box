import { PageShell } from "@/components/page-shell";

export default function SharePage() {
  return (
    <PageShell
      title="分享"
      purpose="箱主复制提问链接的页面。二维码和社交分享卡片还没确认，这里不做。"
      actions={[{ href: "/app", label: "返回工作台", secondary: true }]}
    />
  );
}
