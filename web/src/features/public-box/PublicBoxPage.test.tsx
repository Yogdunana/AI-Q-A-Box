import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderRoutes } from "../../test/render";
import { PublicBoxPage } from "./PublicBoxPage";
import { SubmittedPage } from "./SubmittedPage";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  const { createMockClient } = await import("../../api/mock/client");
  return { ...actual, api: createMockClient({ latency: false }) };
});

const routes = [
  { path: ":slug", element: <PublicBoxPage /> },
  { path: ":slug/submitted", element: <SubmittedPage /> },
];

describe("public question box", () => {
  it("guides a visitor from an empty form to a delivered question", async () => {
    const user = userEvent.setup();
    renderRoutes(routes, "/lin");

    expect(await screen.findByRole("heading", { name: "问我任何事" })).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /发送问题/ });
    await user.click(submit);
    expect(await screen.findByText("先写下你的问题吧。")).toBeInTheDocument();

    await user.type(screen.getByLabelText("你的问题"), "你是怎么安排一天的时间的？");
    await user.click(screen.getByRole("switch", { name: "匿名提问" }));
    await user.click(submit);
    expect(await screen.findByText("请留下一个称呼。")).toBeInTheDocument();

    await user.type(screen.getByLabelText("你的称呼"), "阿远");
    await user.click(submit);

    expect(await screen.findByRole("heading", { name: "问题已提交" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存查看链接" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看回复" })).toBeInTheDocument();
    expect(screen.getByText(/丢失后无法找回/)).toBeInTheDocument();
    const letter = screen.getByText("你是怎么安排一天的时间的？").closest("figure")!;
    expect(within(letter).getByText("你的问题")).toBeInTheDocument();
  });

  it("shows a friendly not-found state for unknown boxes", async () => {
    renderRoutes(routes, "/nobody");
    expect(await screen.findByRole("heading", { name: "找不到这个提问箱" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回到首页" })).toHaveAttribute("href", "/");
  });
});
