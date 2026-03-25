import { describe, it, expect } from "vitest";
import { t, getAvailableLanguages, isValidLanguage, DEFAULT_LANGUAGE } from "../i18n/index.js";

describe("i18n module", () => {
  describe("t() function", () => {
    describe("Korean translations", () => {
      it("should return Korean session.idle.title", () => {
        expect(t("session.idle.title", "ko")).toBe("✨ 작업 완료 및 사용자 대기");
      });

      it("should return Korean session.waiting.title", () => {
        expect(t("session.waiting.title", "ko")).toBe("⏳ 사용자 입력을 기다리고 있습니다");
      });

      it("should return Korean permission.title", () => {
        expect(t("permission.title", "ko")).toBe("🔔 권한 승인이 필요합니다");
      });

      it("should return Korean permission.allow", () => {
        expect(t("permission.allow", "ko")).toBe("✅ 승인합니다");
      });

      it("should return Korean permission.always", () => {
        expect(t("permission.always", "ko")).toBe("✅ 항상 승인합니다");
      });

      it("should return Korean permission.reject", () => {
        expect(t("permission.reject", "ko")).toBe("❌ 거부합니다");
      });

      it("should return Korean todos.title", () => {
        expect(t("todos.title", "ko")).toBe("📋 작업 진행 현황");
      });

      it("should return Korean todos.all_completed", () => {
        expect(t("todos.all_completed", "ko")).toBe("🎉 모든 작업이 완료되었습니다");
      });

      it("should return Korean subtask.title", () => {
        expect(t("subtask.title", "ko")).toBe("🔀 새로운 작업을 시작합니다");
      });

      it("should return Korean error.title", () => {
        expect(t("error.title", "ko")).toBe("❌ 오류 발생");
      });

      it("should return Korean button.allowed", () => {
        expect(t("button.allowed", "ko")).toBe("✅ 승인되었습니다");
      });

      it("should return Korean summary.no_action_needed", () => {
        expect(t("summary.no_action_needed", "ko")).toBe("별도의 조치가 필요하지 않습니다");
      });
    });

    describe("English translations", () => {
      it("should return English session.idle.title", () => {
        expect(t("session.idle.title", "en")).toBe("✨ Task Completed & Waiting");
      });

      it("should return English session.waiting.title", () => {
        expect(t("session.waiting.title", "en")).toBe("⏳ Waiting for Your Input");
      });

      it("should return English permission.title", () => {
        expect(t("permission.title", "en")).toBe("🔔 Approval Required");
      });

      it("should return English permission.allow", () => {
        expect(t("permission.allow", "en")).toBe("✅ Approve");
      });

      it("should return English permission.always", () => {
        expect(t("permission.always", "en")).toBe("✅ Always Approve");
      });

      it("should return English todos.title", () => {
        expect(t("todos.title", "en")).toBe("📋 Task Progress");
      });

      it("should return English todos.all_completed", () => {
        expect(t("todos.all_completed", "en")).toBe("🎉 All tasks completed");
      });

      it("should return English subtask.title", () => {
        expect(t("subtask.title", "en")).toBe("🔀 New Task Started");
      });

      it("should return English subtask.prompt", () => {
        expect(t("subtask.prompt", "en")).toBe("Instructions");
      });

      it("should return English error.title", () => {
        expect(t("error.title", "en")).toBe("❌ Error");
      });

      it("should return English button.allowed", () => {
        expect(t("button.allowed", "en")).toBe("✅ Approved");
      });

      it("should return English summary.no_action_needed", () => {
        expect(t("summary.no_action_needed", "en")).toBe("No action needed");
      });
    });

    describe("Fallback behavior", () => {
      it("should return key as fallback for invalid key", () => {
        expect(t("invalid.key", "ko")).toBe("invalid.key");
      });

      it("should return key as fallback for non-existent key", () => {
        expect(t("nonexistent.path.to.key", "en")).toBe("nonexistent.path.to.key");
      });

      it("should fallback to Korean for invalid language", () => {
        // @ts-expect-error - Testing invalid language
        expect(t("session.idle.title", "invalid")).toBe("✨ 작업 완료 및 사용자 대기");
      });

      it("should use default language (Korean) when no language specified", () => {
        expect(t("session.idle.title")).toBe("✨ 작업 완료 및 사용자 대기");
      });
    });
  });

  describe("getAvailableLanguages()", () => {
    it("should return array of available languages", () => {
      expect(getAvailableLanguages()).toEqual(["ko", "en"]);
    });
  });

  describe("isValidLanguage()", () => {
    it("should return true for 'ko'", () => {
      expect(isValidLanguage("ko")).toBe(true);
    });

    it("should return true for 'en'", () => {
      expect(isValidLanguage("en")).toBe(true);
    });

    it("should return false for invalid language", () => {
      expect(isValidLanguage("ja")).toBe(false);
    });
  });

  describe("DEFAULT_LANGUAGE", () => {
    it("should be 'ko'", () => {
      expect(DEFAULT_LANGUAGE).toBe("ko");
    });
  });
});
