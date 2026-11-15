import type { AnswerRecord, BoxRecord, GenerationRecord, PublicUser, QuestionRecord } from "./store.ts";

export function boxJson(box: BoxRecord) {
  return {
    id: box.id,
    owner_id: box.owner_id,
    slug: box.slug,
    title: box.title,
    description: box.description,
    anonymous_mode: box.anonymous_mode,
    default_reply_visibility: box.default_reply_visibility,
    status: box.status,
    reply_style: box.reply_style,
    created_at: box.created_at,
  };
}

export function sessionJson(user: PublicUser, box: BoxRecord | undefined) {
  return { user, box: box ? boxJson(box) : null };
}

export function questionJson(question: QuestionRecord) {
  return {
    id: question.id,
    box_id: question.box_id,
    content: question.content,
    asker_display_name: question.asker_display_name,
    is_anonymous: question.is_anonymous,
    status: question.status,
    risk_level: question.risk_level,
    submitted_at: question.submitted_at,
  };
}

export function answerJson(answer: AnswerRecord) {
  return {
    id: answer.id,
    question_id: answer.question_id,
    content: answer.content,
    visibility: answer.visibility,
    source: answer.source,
    delivery_state: answer.delivery_state,
    updated_at: answer.updated_at,
    published_at: answer.published_at,
    sent_at: answer.sent_at,
  };
}

export function generationJson(generation: GenerationRecord) {
  return {
    id: generation.id,
    question_id: generation.question_id,
    provider: generation.provider,
    model: generation.model,
    prompt_version: generation.prompt_version,
    output: generation.output,
    status: generation.status,
    created_at: generation.created_at,
  };
}

export function publicBoxJson(box: BoxRecord) {
  return {
    slug: box.slug,
    title: box.title,
    description: box.description,
    anonymous_mode: box.anonymous_mode,
    accepting: box.status === "active",
    owner: {
      display_name: box.owner_display_name ?? "",
      avatar_url: box.owner_avatar_url ?? null,
    },
  };
}
