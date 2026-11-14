import { useCallback } from "react";
import { api, messageFor, type Question, type QuestionDetail, type QuestionList, type QuestionStatus } from "../../api";
import { invalidate, setQueryData, updateQueries, useQuery } from "../../lib/query";
import { restoredStatus } from "../../lib/status";
import { useToast } from "../../state/toast";

export const detailKey = (id: string) => `questions:detail:${id}`;

export function useQuestionDetail(id: string | null) {
  return useQuery(id ? detailKey(id) : null, () => api.getQuestion(id!));
}

function patchEverywhere(id: string, patch: Partial<Question>) {
  updateQueries<QuestionList>("questions:list:", (list) => ({
    ...list,
    items: list.items.map((q) => (q.id === id ? { ...q, ...patch } : q)),
  }));
  setQueryData<QuestionDetail>(detailKey(id), (detail) =>
    detail ? { ...detail, question: { ...detail.question, ...patch } } : detail,
  );
}

const STATUS_TOAST: Partial<Record<QuestionStatus, string>> = {
  archived: "已归档",
  spam: "已标记为垃圾",
  flagged: "已标记为需留意",
};

export function useQuestionActions() {
  const toast = useToast();

  const setStatus = useCallback(
    async (
      question: Question,
      status: QuestionStatus,
      options: { silent?: boolean; undoable?: boolean; message?: string } = {},
    ) => {
      const previous = question.status;
      patchEverywhere(question.id, { status });
      try {
        await api.updateQuestionStatus(question.id, status);
        invalidate("questions:");
        if (options.silent) return true;
        const message = options.message ?? STATUS_TOAST[status] ?? "状态已更新";
        toast.success(message, {
          action: options.undoable
            ? {
                label: "撤销",
                onAction: () => {
                  patchEverywhere(question.id, { status: previous });
                  api.updateQuestionStatus(question.id, previous).then(
                    () => invalidate("questions:"),
                    (error) => {
                      toast.error(messageFor(error));
                      invalidate("questions:");
                    },
                  );
                },
              }
            : undefined,
        });
        return true;
      } catch (error) {
        patchEverywhere(question.id, { status: previous });
        if (!options.silent) toast.error(messageFor(error));
        return false;
      }
    },
    [toast],
  );

  const restore = useCallback(
    (detail: QuestionDetail, message = "已移回收件箱") =>
      setStatus(detail.question, restoredStatus(detail.answer, detail.generations.length > 0), { message }),
    [setStatus],
  );

  const remove = useCallback(
    async (question: Question) => {
      try {
        await api.deleteQuestion(question.id);
        updateQueries<QuestionList>("questions:list:", (list) => ({
          ...list,
          items: list.items.filter((q) => q.id !== question.id),
        }));
        invalidate("questions:");
        toast.success("问题已删除");
        return true;
      } catch (error) {
        toast.error(messageFor(error));
        return false;
      }
    },
    [toast],
  );

  return { setStatus, restore, remove };
}
