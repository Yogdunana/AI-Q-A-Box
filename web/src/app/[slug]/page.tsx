import { PageShell } from "@/components/page-shell";

export default async function QuestionBoxPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <PageShell title={slug} purpose="向这位箱主提出一个问题。" wide>
      <div className="split">
        <div className="split-copy">
          <ul>
            <li>匿名是否默认开启，还没有产品决定。</li>
            <li>提问者要不要登录，还没有产品决定。</li>
          </ul>
        </div>
        <form className="split-panel panel" action={`/${slug}/submitted`}>
          <label className="field">
            问题
            <textarea name="question" maxLength={1000} placeholder="写下想问的问题" />
          </label>
          <p className="meta">最多 1000 字。提交后的保存会在后续任务接入。</p>
          <div className="actions">
            <button className="button" type="submit">
              提交
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
