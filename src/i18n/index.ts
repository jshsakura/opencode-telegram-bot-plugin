/**
 * i18n module - Internationalization support for Korean and English
 */

import { ko } from "./ko.js";
import { en } from "./en.js";

export type Language = "ko" | "en";

// Define the translation structure interface
export interface TranslationMessages {
  session: {
    idle: {
      title: string;
      session: string;
      stats: string;
      files: string;
    };
  };
  permission: {
    title: string;
    action: string;
    command: string;
    path: string;
    allow: string;
    always: string;
    reject: string;
  };
  todos: {
    title: string;
    more: string;
  };
  subtask: {
    title: string;
    agent: string;
    description: string;
    prompt: string;
  };
  error: {
    title: string;
  };
  button: {
    allowed: string;
    always_allowed: string;
    rejected: string;
  };
}

export const translations: Record<Language, TranslationMessages> = {
  ko,
  en,
};

/**
 * Default language
 */
export const DEFAULT_LANGUAGE: Language = "ko";

/**
 * Get translation by key path (e.g., "session.idle.title")
 * @param key - Dot-separated key path
 * @param lang - Language code ('ko' or 'en')
 * @returns Translated string or key if not found
 */
export function t(key: string, lang: Language = DEFAULT_LANGUAGE): string {
  // Fallback to Korean for invalid language
  const safeLang: Language = lang === "ko" || lang === "en" ? lang : "ko";
  
  const translation = translations[safeLang];
  
  // Navigate through nested object using key path
  const parts = key.split(".");
  let result: unknown = translation;
  
  for (const part of parts) {
    if (result && typeof result === "object" && part in result) {
      result = (result as Record<string, unknown>)[part];
    } else {
      // Key not found, return the key itself as fallback
      return key;
    }
  }
  
  // Return the value if it's a string, otherwise return the key
  return typeof result === "string" ? result : key;
}

/**
 * Get all available languages
 */
export function getAvailableLanguages(): Language[] {
  return ["ko", "en"];
}

/**
 * Check if a language is valid
 */
export function isValidLanguage(lang: string): lang is Language {
  return lang === "ko" || lang === "en";
}

export { ko, en };
