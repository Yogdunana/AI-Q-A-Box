/**
 * Frontend view of the data model in docs/prd.md §9. Field names follow the
 * PRD's snake_case so the HTTP client can pass payloads through unchanged.
 */

export type QuestionStatus =
  | "submitted"
  | "reviewing"
  | "drafted"
  | "answered_private"
  | "published"
  | "archived"
  | "spam"
  | "flagged"
  | "deleted";

export type ReplyVisibility = "private" | "public";
export type AnonymousMode = "allowed" | "disabled";
export type BoxStatus = "active" | "paused";

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export type ReplyTone = "warm" | "direct" | "playful" | "professional";
export type ReplyLength = "short" | "medium" | "long";
export type ReplyLanguage = "auto" | "zh" | "en";

/** The reply style an owner explicitly saves; the only owner context sent to the model. */
export interface ReplyStyle {
  tone: ReplyTone;
  length: ReplyLength;
  language: ReplyLanguage;
  notes: string;
}

export interface QuestionBox {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string;
  anonymous_mode: AnonymousMode;
  default_reply_visibility: ReplyVisibility;
  status: BoxStatus;
  reply_style: ReplyStyle;
  created_at: string;
}

export interface Question {
  id: string;
  box_id: string;
  content: string;
  asker_display_name: string | null;
  is_anonymous: boolean;
  status: QuestionStatus;
  risk_level: "none" | "review";
  submitted_at: string;
  /** True only when the asker explicitly allowed a public reply. */
  public_consent: boolean;
}

export interface Answer {
  id: string;
  question_id: string;
  content: string;
  visibility: ReplyVisibility;
  source: "human" | "ai_assisted";
  updated_at: string;
  published_at: string | null;
  /** Confirmation time for a private reply. This is not a delivery time. */
  sent_at: string | null;
  delivery_state: "draft" | "private_reserved" | "published";
  confirmed_content: string | null;
  confirmed_at: string | null;
  seen_at: string | null;
  draft_revision: number;
}

export interface AiGeneration {
  id: string;
  question_id: string;
  provider: string;
  model: string;
  prompt_version: string;
  output: string;
  status: "completed" | "failed";
  created_at: string;
}

export interface Session {
  user: User;
  box: QuestionBox | null;
}

export interface PublicBox {
  slug: string;
  title: string;
  description: string;
  anonymous_mode: AnonymousMode;
  accepting: boolean;
  owner: { display_name: string; avatar_url: string | null };
}

export interface PublicAnswer {
  id: string;
  question: string;
  answer: string;
  published_at: string;
}

export interface QuestionListParams {
  status?: QuestionStatus[];
  q?: string;
}

export type StatusCounts = Partial<Record<QuestionStatus, number>>;

export interface QuestionList {
  items: Question[];
  total: number;
  counts: StatusCounts;
}

export interface QuestionDetail {
  question: Question;
  answer: Answer | null;
  generations: AiGeneration[];
}

export interface SubmitQuestionInput {
  content: string;
  is_anonymous: boolean;
  asker_display_name?: string;
  idempotency_key: string;
  /** High-entropy secret held by the asker. The idempotency key is not this value. */
  view_token: string;
  allow_public?: boolean;
}

export interface Capabilities {
  public_replies_enabled: boolean;
  asker_access: "link";
  notifications: "none";
}

export interface ReplyAccess {
  state: "pending" | "confirmed" | "deleted";
  box?: { title: string; owner_display_name: string };
  question?: { content: string; submitted_at: string };
  reply?: { content: string; confirmed_at: string } | null;
}

export interface BoxInput {
  slug: string;
  title: string;
  description: string;
  anonymous_mode: AnonymousMode;
  default_reply_visibility: ReplyVisibility;
  status: BoxStatus;
  reply_style: ReplyStyle;
}

export interface AnswerInput {
  content: string;
  visibility: ReplyVisibility;
  source: Answer["source"];
  draft_revision?: number;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface RegisterInput extends Credentials {
  display_name: string;
}

export interface ApiClient {
  readonly mode: "mock" | "http";

  getSession(): Promise<Session | null>;
  login(input: Credentials): Promise<Session>;
  register(input: RegisterInput): Promise<Session>;
  logout(): Promise<void>;
  updateProfile(input: { display_name: string }): Promise<User>;

  getCapabilities(): Promise<Capabilities>;
  getPublicBox(slug: string): Promise<PublicBox>;
  getPublicAnswers(slug: string): Promise<PublicAnswer[]>;
  submitQuestion(slug: string, input: SubmitQuestionInput): Promise<{ id: string }>;
  readReply(token: string): Promise<ReplyAccess>;

  createBox(input: BoxInput): Promise<QuestionBox>;
  updateBox(id: string, input: Partial<BoxInput>): Promise<QuestionBox>;

  listQuestions(params: QuestionListParams): Promise<QuestionList>;
  getQuestion(id: string): Promise<QuestionDetail>;
  updateQuestionStatus(id: string, status: QuestionStatus): Promise<Question>;
  deleteQuestion(id: string): Promise<void>;

  generateDraft(questionId: string, signal?: AbortSignal): Promise<AiGeneration>;
  deleteDraft(questionId: string, generationId: string): Promise<void>;

  saveAnswer(questionId: string, input: AnswerInput): Promise<Answer>;
  updateAnswer(answerId: string, input: Partial<AnswerInput>): Promise<Answer>;
  publishAnswer(answerId: string, visibility: ReplyVisibility, draftRevision?: number): Promise<Answer>;
}
