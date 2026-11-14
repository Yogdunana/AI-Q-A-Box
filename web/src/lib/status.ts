import type { Answer, QuestionStatus, StatusCounts } from "../api/types";

export type StatusTone =
  | "new"
  | "reviewing"
  | "drafted"
  | "answered"
  | "published"
  | "flagged"
  | "muted";

export const STATUS_META: Record<QuestionStatus, { label: string; tone: StatusTone }> = {
  submitted: { label: "新问题", tone: "new" },
  reviewing: { label: "处理中", tone: "reviewing" },
  drafted: { label: "有草稿", tone: "drafted" },
  answered_private: { label: "已私密回复", tone: "answered" },
  published: { label: "已公开", tone: "published" },
  archived: { label: "已归档", tone: "muted" },
  spam: { label: "垃圾", tone: "muted" },
  flagged: { label: "需留意", tone: "flagged" },
  deleted: { label: "已删除", tone: "muted" },
};

export type InboxView = "pending" | "new" | "drafted" | "flagged" | "answered" | "archived" | "spam";

export interface InboxViewMeta {
  id: InboxView;
  label: string;
  statuses: QuestionStatus[];
  emptyTitle: string;
  emptyBody: string;
}

export const INBOX_VIEWS: InboxViewMeta[] = [
  {
    id: "pending",
    label: "待处理",
    statuses: ["submitted", "reviewing", "drafted", "flagged"],
    emptyTitle: "全部处理完了",
    emptyBody: "新问题到达时会出现在这里。",
  },
  {
    id: "new",
    label: "新问题",
    statuses: ["submitted"],
    emptyTitle: "没有未读的新问题",
    emptyBody: "你已经看过所有问题了。",
  },
  {
    id: "drafted",
    label: "有草稿",
    statuses: ["drafted"],
    emptyTitle: "没有进行中的草稿",
    emptyBody: "为问题生成或保存草稿后，会集中出现在这里。",
  },
  {
    id: "flagged",
    label: "需留意",
    statuses: ["flagged"],
    emptyTitle: "没有需要留意的问题",
    emptyBody: "把需要人工仔细核对的问题标记出来，它们会集中在这里。",
  },
  {
    id: "answered",
    label: "已回复",
    statuses: ["answered_private", "published"],
    emptyTitle: "还没有回复过问题",
    emptyBody: "确认发出的回复会归档在这里。",
  },
  {
    id: "archived",
    label: "已归档",
    statuses: ["archived"],
    emptyTitle: "归档是空的",
    emptyBody: "暂时不想处理的问题，可以先归档。",
  },
  {
    id: "spam",
    label: "垃圾",
    statuses: ["spam"],
    emptyTitle: "没有垃圾问题",
    emptyBody: "被标记为垃圾的问题会放在这里。",
  },
];

export const INBOX_VIEW_BY_ID = Object.fromEntries(INBOX_VIEWS.map((v) => [v.id, v])) as Record<
  InboxView,
  InboxViewMeta
>;

export function isInboxView(value: string | null): value is InboxView {
  return value !== null && value in INBOX_VIEW_BY_ID;
}

export function countFor(view: InboxViewMeta, counts: StatusCounts): number {
  return view.statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
}

/**
 * Where a question goes when it leaves archived / flagged / spam: back to the
 * furthest point it had reached in the reply workflow.
 */
export function restoredStatus(answer: Answer | null, hasDraft: boolean): QuestionStatus {
  if (answer?.published_at) return "published";
  if (answer?.sent_at) return "answered_private";
  if (answer || hasDraft) return "drafted";
  return "reviewing";
}

export function isAnswered(status: QuestionStatus): boolean {
  return status === "answered_private" || status === "published";
}

export function isOutOfInbox(status: QuestionStatus): boolean {
  return status === "archived" || status === "spam" || status === "deleted";
}
