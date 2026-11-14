import Link from "next/link";
import { PageShell } from "@/components/page-shell";

const filters = ["待处理", "已回复", "归档"];

export default function InboxPage() {
  return (
    <PageShell title="收件箱" purpose="只显示你自己的问题。现在还没有问题。" wide>
      <div className="inbox">
        <div className="inbox-filters chips" aria-label="状态筛选">
          {filters.map((filter) => (
            <span className="chip" key={filter}>
              {filter} 0
            </span>
          ))}
        </div>
        <section className="inbox-list panel">
          <h2>问题</h2>
          <p>列表是空的。分享提问链接后，新问题会出现在这里。</p>
        </section>
        <section className="inbox-detail panel">
          <h2>详情</h2>
          <p>在手机上，详情排在列表下面。平板和 Duo 打开后在右侧。电脑上单独占一列。</p>
          <div className="actions">
            <Link className="button secondary" href="/app/questions/preview">
              打开问题详情
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
