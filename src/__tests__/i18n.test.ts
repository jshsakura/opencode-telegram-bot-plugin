import { describe, it, expect } from "vitest";
import { t, getAvailableLanguages, isValidLanguage, DEFAULT_LANGUAGE } from "../i18n/index.js";

describe("i18n module", () => {
  describe("t() function", () => {
    describe("Korean translations", () => {
      it("should return Korean session.idle.title", () => {
        expect(t("session.idle.title", "ko")).toBe("🚀 작업 완료");
      });

      it("should return Korean session.idle.session", () => {
        expect(t("session.idle.session", "ko")).toBe("세션");
      });

      it("should return Korean permission.title", () => {
        expect(t("permission.title", "ko")).toBe("🔔 권한 요청");
      });

      it("should return Korean permission.action", () => {
        expect(t("permission.action", "ko")).toBe("작업");
      });

      it("should return Korean permission.command", () => {
        expect(t("permission.command", "ko")).toBe("명령어");
      });

      it("should return Korean permission.path", () => {
        expect(t("permission.path", "ko")).toBe("경로");
      });

      it("should return Korean permission.allow", () => {
        expect(t("permission.allow", "ko")).toBe("✅ 허용");
      });

      it("should return Korean permission.always", () => {
        expect(t("permission.always", "ko")).toBe("✅ 항상 허용");
      });

      it("should return Korean permission.reject", () => {
        expect(t("permission.reject", "ko")).toBe("❌ 거부");
      });

      it("should return Korean todos.title", () => {
        expect(t("todos.title", "ko")).toBe("📋 모든 작업 완료");
      });

      it("should return Korean todos.more", () => {
        expect(t("todos.more", "ko")).toBe("... 외 N개 더");
      });

      it("should return Korean subtask.title", () => {
        expect(t("subtask.title", "ko")).toBe("🔀 하위 작업 시작");
      });

      it("should return Korean subtask.agent", () => {
        expect(t("subtask.agent", "ko")).toBe("에이전트");
      });

      it("should return Korean subtask.description", () => {
        expect(t("subtask.description", "ko")).toBe("설명");
      });

      it("should return Korean subtask.prompt", () => {
        expect(t("subtask.prompt", "ko")).toBe("프롬프트");
      });

      it("should return Korean error.title", () => {
        expect(t("error.title", "ko")).toBe("❌ 오류");
      });

      it("should return Korean button.allowed", () => {
        expect(t("button.allowed", "ko")).toBe("✅ 허용됨");
      });

      it("should return Korean button.always_allowed", () => {
        expect(t("button.always_allowed", "ko")).toBe("✅ 항상 허용");
      });

      it("should return Korean button.rejected", () => {
        expect(t("button.rejected", "ko")).toBe("❌ 거부됨");
      });
    });

    describe("English translations", () => {
      it("should return English session.idle.title", () => {
        expect(t("session.idle.title", "en")).toBe("🚀 Task Complete");
      });

      it("should return English session.idle.session", () => {
        expect(t("session.idle.session", "en")).toBe("Session");
      });

      it("should return English permission.title", () => {
        expect(t("permission.title", "en")).toBe("🔔 Permission Request");
      });

      it("should return English permission.action", () => {
        expect(t("permission.action", "en")).toBe("Action");
      });

      it("should return English permission.command", () => {
        expect(t("permission.command", "en")).toBe("Command");
      });

      it("should return English permission.path", () => {
        expect(t("permission.path", "en")).toBe("Path");
      });

      it("should return English permission.allow", () => {
        expect(t("permission.allow", "en")).toBe("✅ Allow");
      });

      it("should return English permission.always", () => {
        expect(t("permission.always", "en")).toBe("✅ Always");
      });

      it("should return English permission.reject", () => {
        expect(t("permission.reject", "en")).toBe("❌ Reject");
      });

      it("should return English todos.title", () => {
        expect(t("todos.title", "en")).toBe("📋 All Tasks Complete");
      });

      it("should return English todos.more", () => {
        expect(t("todos.more", "en")).toBe("... and N more");
      });

      it("should return English subtask.title", () => {
        expect(t("subtask.title", "en")).toBe("🔀 Subtask Started");
      });

      it("should return English subtask.agent", () => {
        expect(t("subtask.agent", "en")).toBe("Agent");
      });

      it("should return English subtask.description", () => {
        expect(t("subtask.description", "en")).toBe("Description");
      });

      it("should return English subtask.prompt", () => {
        expect(t("subtask.prompt", "en")).toBe("Prompt");
      });

      it("should return English error.title", () => {
        expect(t("error.title", "en")).toBe("❌ Error");
      });

      it("should return English button.allowed", () => {
        expect(t("button.allowed", "en")).toBe("✅ Allowed");
      });

      it("should return English button.always_allowed", () => {
        expect(t("button.always_allowed", "en")).toBe("✅ Always Allowed");
      });

      it("should return English button.rejected", () => {
        expect(t("button.rejected", "en")).toBe("❌ Rejected");
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
        expect(t("session.idle.title", "invalid")).toBe("🚀 작업 완료");
      });

      it("should use default language (Korean) when no language specified", () => {
        expect(t("session.idle.title")).toBe("🚀 작업 완료");
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

    it("should return false for empty string", () => {
      expect(isValidLanguage("")).toBe(false);
    });
  });

  describe("DEFAULT_LANGUAGE", () => {
    it("should be 'ko'", () => {
      expect(DEFAULT_LANGUAGE).toBe("ko");
    });
  });
});
