import { PageShell } from "@/components/page-shell";

export default async function SubmittedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PageShell
      title="已收到"
      purpose="提交成功后会来到这里。现在还没有保存问题。"
      notes={["邮件通知、查询码和公开回复都还没有产品决定，这里不作承诺。"]}
      actions={[{ href: `/${slug}`, label: "返回这个提问箱", secondary: true }]}
    />
  );
}
