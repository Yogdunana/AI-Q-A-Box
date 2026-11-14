import { api } from "../../api";
import { useQuery } from "../../lib/query";

/** Per-status counts for the owner's box. Shares the "questions:" cache prefix so mutations refresh it. */
export function useInboxCounts() {
  const query = useQuery("questions:counts", () => api.listQuestions({ status: ["submitted"] }));
  return { counts: query.data?.counts ?? {}, loading: query.loading };
}
