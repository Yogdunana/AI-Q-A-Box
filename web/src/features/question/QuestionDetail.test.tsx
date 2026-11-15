import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../../api";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../../api/mock/seed";
import { clearQueries } from "../../lib/query";
import { renderRoutes } from "../../test/render";
import { QuestionPage } from "./QuestionPage";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  const { createMockClient } = await import("../../api/mock/client");
  return { ...actual, api: createMockClient({ latency: false }) };
});

const routes = [
  { path: "/app/questions/:id", element: <QuestionPage /> },
  { path: "/app/inbox", element: <p>inbox</p> },
];

beforeEach(async () => {
  clearQueries();
  await api.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
});

describe("question detail", () => {
  it("drafts with AI, lets the owner adopt and edit, and publishes only after confirmation", async () => {
    const user = userEvent.setup();
    renderRoutes(routes, "/app/questions/q_demo_2");

    expect(await screen.findByText(/想转行做产品设计/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "生成回复草稿" }));
    const adopt = await screen.findByRole("button", { name: "采用并编辑" });
    await waitFor(() => expect(adopt).toBeEnabled(), { timeout: 3000 });

    expect((await api.getQuestion("q_demo_2")).answer).toBeNull();

    await user.click(adopt);
    const editor = screen.getByLabelText<HTMLTextAreaElement>("回复内容");
    expect(editor.value).toContain("谢谢你认真地问出这个问题");
    expect(screen.getByText("基于 AI 草稿")).toBeInTheDocument();

    await user.type(editor, "补充一句。");
    await user.click(screen.getByRole("button", { name: "确认回复" }));

    const dialog = await screen.findByRole("dialog", { name: "确认这条回复？" });
    expect(within(dialog).getByText(/这条回复基于 AI 草稿/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "公开" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "确认回复" }));

    expect(await screen.findByText(/回复已确认/)).toBeInTheDocument();
    expect(await screen.findByText("AI 协助起草")).toBeInTheDocument();

    const stored = await api.getQuestion("q_demo_2");
    expect(stored.question.status).toBe("answered_private");
    expect(stored.answer).toMatchObject({ visibility: "private", source: "ai_assisted" });
    expect(stored.answer!.content).toContain("补充一句。");
  });

  it("keeps unsaved reply text when a navigation is cancelled", async () => {
    const user = userEvent.setup();
    const { router } = renderRoutes(routes, "/app/questions/q_demo_1");
    await screen.findByText(/做独立产品的第一年/);
    const editor = screen.getByLabelText<HTMLTextAreaElement>("回复内容");
    await user.type(editor, "先记在这里");
    await router.navigate("/app/inbox");
    const dialog = await screen.findByRole("dialog", { name: "回复还没保存" });
    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(screen.getByLabelText<HTMLTextAreaElement>("回复内容").value).toContain("先记在这里");
    expect(router.state.location.pathname).toBe("/app/questions/q_demo_1");
  });

  it("asks before marking a question as spam", async () => {
    const user = userEvent.setup();
    renderRoutes(routes, "/app/questions/q_demo_1");
    await screen.findByText(/做独立产品的第一年/);

    await user.click(screen.getByRole("button", { name: "更多操作" }));
    await user.click(await screen.findByRole("menuitem", { name: "标记为垃圾" }));
    const dialog = await screen.findByRole("dialog", { name: "标记为垃圾？" });
    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect((await api.getQuestion("q_demo_1")).question.status).not.toBe("spam");
  });
});
