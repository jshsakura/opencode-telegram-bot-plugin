import { ko } from "./ko.js";
import { en } from "./en.js";

export type Language = "ko" | "en";

export interface TranslationMessages {
  session: {
    idle: {
      title: string;
      session: string;
      stats: string;
      files: string;
      duration: string;
      waiting_for_input: string;
      ready_to_continue: string;
    };
    progress: {
      title: string;
      elapsed: string;
    };
    waiting: {
      title: string;
      prompt: string;
      please_respond: string;
    };
  };
  permission: {
    title: string;
    subtitle: string;
    action: string;
    command: string;
    path: string;
    allow: string;
    always: string;
    reject: string;
    waiting_for_approval: string;
  };
  todos: {
    title: string;
    completed: string;
    in_progress: string;
    pending: string;
    all_completed: string;
    progress: string;
    more: string;
  };
  subtask: {
    title: string;
    agent: string;
    description: string;
    prompt: string;
    status_running: string;
    status_waiting: string;
  };
  error: {
    title: string;
    subtitle: string;
    retry_suggested: string;
    support_needed: string;
  };
  button: {
    allowed: string;
    always_allowed: string;
    rejected: string;
    continue: string;
    pause: string;
    cancel: string;
  };
  status: {
    idle: string;
    busy: string;
    waiting_for_user: string;
    completed: string;
    error: string;
    cancelled: string;
  };
  summary: {
    title: string;
    tasks_completed: string;
    files_changed: string;
    time_elapsed: string;
    no_action_needed: string;
  };
}

export const translations: Record<Language, TranslationMessages> = {
  ko,
  en,
};

export const DEFAULT_LANGUAGE: Language = "ko";

export function t(key: string, lang: Language = DEFAULT_LANGUAGE): string {
  const safeLang: Language = lang === "ko" || lang === "en" ? lang : "ko";
  const translation = translations[safeLang];
  const parts = key.split(".");
  let result: unknown = translation;
  
  for (const part of parts) {
    if (result && typeof result === "object" && part in result) {
      result = (result as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  
  return typeof result === "string" ? result : key;
}

export function getAvailableLanguages(): Language[] {
  return ["ko", "en"];
}

export function isValidLanguage(lang: string): lang is Language {
  return lang === "ko" || lang === "en";
}

export { ko, en };
