import { PageShell } from "@/components/page-shell";

export default async function QuestionBoxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PageShell
      title={slug}
      purpose="这里将展示这位箱主的提问箱。表单、字符计数和提交会在后续任务里接上。"
      notes={[
        "匿名是否默认开启，还没有产品决定。",
        "提问者要不要登录，还没有产品决定。",
      ]}
      actions={[{ href: `/${slug}/submitted`, label: "查看提交结果占位", secondary: true }]}
    />
  );
}
