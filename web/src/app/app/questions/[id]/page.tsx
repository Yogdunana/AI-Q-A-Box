import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell title={`问题 ${id}`} purpose="原问题和回复草稿分成两块。草稿不会自动发出，也不会自动公开。" wide>
      <div className="pair">
        <section className="pair-question panel">
          <p className="meta">原问题</p>
          <p>这里显示提问者写下的原文。模型供应商确定之前，不会把问题发到外部。</p>
        </section>
        <section className="pair-draft panel draft">
          <p className="meta">草稿</p>
          <p>AI 草稿和原文用不同底色分开。现在还没有生成草稿，可以直接手写回复。</p>
          <div className="actions">
            <Link className="button secondary" href="/app/inbox">
              返回收件箱
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
