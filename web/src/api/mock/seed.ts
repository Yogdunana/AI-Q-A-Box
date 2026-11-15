import { DEFAULT_REPLY_STYLE } from "../defaults";
import type { AiGeneration, Answer, Question, QuestionBox, User } from "../types";
import { composeMockDraft } from "./draft";

export interface StoredUser extends User {
  password: string;
}

export interface MockDb {
  version: 2;
  users: StoredUser[];
  boxes: QuestionBox[];
  questions: Question[];
  answers: Answer[];
  generations: AiGeneration[];
  idempotency: Record<string, string>;
  /** Demo-only copy of the view token. The real server stores a hash instead. */
  viewTokens: Record<string, string>;
}

export const DEMO_EMAIL = "demo@askme.local";
export const DEMO_PASSWORD = "askme-demo";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface SeedQuestion {
  content: string;
  ago: number;
  status: Question["status"];
  nickname?: string;
  answer?: { content: string; visibility: Answer["visibility"]; source: Answer["source"] };
  draft?: boolean;
}

const SEED: SeedQuestion[] = [
  {
    content: "做独立产品的第一年，你是怎么判断一个想法值不值得继续投入的？有没有一个具体的信号让你决定坚持下去？",
    ago: 14 * MINUTE,
    status: "submitted",
  },
  {
    content: "想转行做产品设计，但是没有相关学历背景。作品集应该从哪里开始准备比较好？",
    ago: 52 * MINUTE,
    status: "submitted",
    nickname: "小周",
  },
  {
    content: "How do you keep a consistent visual language when you're the only designer on a product?",
    ago: 3 * HOUR,
    status: "submitted",
  },
  {
    content: "最近总觉得自己做的东西没人看，会不会是方向错了？你有过类似的阶段吗？",
    ago: 5 * HOUR,
    status: "reviewing",
  },
  {
    content: "你平时用什么工具做原型？Figma 之外还有推荐的吗？",
    ago: 20 * HOUR,
    status: "drafted",
    nickname: "Mia",
    draft: true,
  },
  {
    content: "能分享一下你的日程安排吗？白天上班晚上做副业，总觉得精力不够用。",
    ago: 1 * DAY + 3 * HOUR,
    status: "flagged",
  },
  {
    content: "你觉得 AI 会取代界面设计师吗？",
    ago: 2 * DAY,
    status: "answered_private",
    answer: {
      content:
        "我不太担心「取代」，更关心「分工怎么变」。工具会接过越来越多重复的部分，但判断什么值得做、为谁做、做到什么程度，依然需要人。\n\n与其担心，不如把时间花在理解问题本身上。",
      visibility: "private",
      source: "ai_assisted",
    },
  },
  {
    content: "推荐几本对你影响比较大的设计类书籍？",
    ago: 3 * DAY,
    status: "answered_private",
    nickname: "阿青",
    answer: {
      content:
        "《设计心理学》适合入门，《写给大家看的设计书》很实用。如果只能选一本，我会推荐《The Shape of Design》——它讲的是为什么做，而不是怎么做。",
      visibility: "private",
      source: "human",
    },
  },
  {
    content: "上次你提到的那个项目后来怎么样了？还在继续吗？",
    ago: 4 * DAY,
    status: "answered_private",
    answer: {
      content: "还在继续，只是节奏慢了一些。等有阶段性成果了，我会再写一篇完整的复盘。",
      visibility: "private",
      source: "human",
    },
  },
  {
    content: "加我微信聊聊合作？",
    ago: 5 * DAY,
    status: "spam",
  },
  {
    content: "你会在意别人怎么评价你的作品吗？",
    ago: 9 * DAY,
    status: "archived",
  },
];

export function createSeed(now = Date.now()): MockDb {
  const iso = (offset: number) => new Date(now - offset).toISOString();

  const user: StoredUser = {
    id: "usr_demo",
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    display_name: "林一",
    avatar_url: null,
    created_at: iso(30 * DAY),
  };

  const box: QuestionBox = {
    id: "box_demo",
    owner_id: user.id,
    slug: "lin",
    title: "问我任何事",
    description: "独立设计师，在做一些小而美的产品。关于设计、职业，或者生活里的小事，都可以问。",
    anonymous_mode: "allowed",
    default_reply_visibility: "private",
    status: "active",
    reply_style: { ...DEFAULT_REPLY_STYLE, notes: "我是独立设计师，做过五年 B 端产品，现在专注个人项目。回答尽量简短、真诚，不说空话。" },
    created_at: iso(30 * DAY),
  };

  const db: MockDb = {
    version: 2,
    users: [user],
    boxes: [box],
    questions: [],
    answers: [],
    generations: [],
    idempotency: {},
    viewTokens: {},
  };

  SEED.forEach((item, index) => {
    const id = `q_demo_${index + 1}`;
    db.questions.push({
      id,
      box_id: box.id,
      content: item.content,
      asker_display_name: item.nickname ?? null,
      is_anonymous: !item.nickname,
      status: item.status,
      risk_level: item.status === "flagged" ? "review" : "none",
      submitted_at: iso(item.ago),
      public_consent: false,
    });

    if (item.draft) {
      db.generations.push({
        id: `gen_demo_${index + 1}`,
        question_id: id,
        provider: "local",
        model: "mock-draft-v1",
        prompt_version: "2026-11",
        output: composeMockDraft(item.content, box.reply_style),
        status: "completed",
        created_at: iso(item.ago - 10 * MINUTE),
      });
    }

    if (item.answer) {
      const answeredAt = iso(item.ago - 2 * HOUR);
      db.answers.push({
        id: `ans_demo_${index + 1}`,
        question_id: id,
        content: item.answer.content,
        visibility: item.answer.visibility,
        source: item.answer.source,
        updated_at: answeredAt,
        published_at: null,
        sent_at: answeredAt,
        delivery_state: "private_reserved",
        confirmed_content: item.answer.content,
        confirmed_at: answeredAt,
        seen_at: null,
        draft_revision: 1,
      });
    }
  });

  return db;
}
