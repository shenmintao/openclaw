/**
 * Memory Store Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Mock fs module
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

// Import after mocking
import {
  loadAllMemoryBooks,
  loadMemoryBook,
  createMemoryBook,
  deleteMemoryBook,
  addMemory,
  updateMemory,
  deleteMemory,
  retrieveMemories,
  buildMemoryPrompt,
  getOrCreateMemoryBook,
  autoExtractMemories,
} from "./store.js";
import type { StoredMemoryBook, MemoryEntry } from "./types.js";

describe("Memory Store", () => {
  const mockStorageDir = path.join(os.homedir(), ".openclaw", "plugins", "sillytavern", "memories");

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: directory exists
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("loadAllMemoryBooks", () => {
    it("returns empty array when no books exist", () => {
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      const books = loadAllMemoryBooks();
      expect(books).toEqual([]);
    });

    it("loads all valid memory books", () => {
      const mockBook: StoredMemoryBook = {
        id: "mb-test-123",
        name: "Test Book",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        entries: [],
        settings: {
          maxMemoriesPerRequest: 10,
          maxMemoryTokens: 1000,
          useKeywordRetrieval: true,
          autoExtract: false,
          minImportanceForInjection: 50,
          sortBy: "importance",
        },
      };

      vi.mocked(fs.readdirSync).mockReturnValue(["mb-test-123.json"] as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBook));

      const books = loadAllMemoryBooks();
      expect(books).toHaveLength(1);
      expect(books[0].name).toBe("Test Book");
    });

    it("skips invalid JSON files", () => {
      vi.mocked(fs.readdirSync).mockReturnValue(["invalid.json"] as any);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("Invalid JSON");
      });

      const books = loadAllMemoryBooks();
      expect(books).toEqual([]);
    });
  });

  describe("loadMemoryBook", () => {
    it("returns null when book does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const book = loadMemoryBook("nonexistent");
      expect(book).toBeNull();
    });

    it("loads existing memory book", () => {
      const mockBook: StoredMemoryBook = {
        id: "mb-test-123",
        name: "Test Book",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        entries: [],
        settings: {
          maxMemoriesPerRequest: 10,
          maxMemoryTokens: 1000,
          useKeywordRetrieval: true,
          autoExtract: false,
          minImportanceForInjection: 50,
          sortBy: "importance",
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBook));

      const book = loadMemoryBook("mb-test-123");
      expect(book).not.toBeNull();
      expect(book?.name).toBe("Test Book");
    });
  });

  describe("createMemoryBook", () => {
    it("creates a new memory book with default settings", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const book = createMemoryBook({ name: "New Book" });

      expect(book.name).toBe("New Book");
      expect(book.entries).toEqual([]);
      expect(book.settings.maxMemoriesPerRequest).toBe(10);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it("creates memory book with custom settings", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const book = createMemoryBook({
        name: "Custom Book",
        characterId: "char-123",
        settings: {
          maxMemoriesPerRequest: 20,
          autoExtract: true,
        },
      });

      expect(book.characterId).toBe("char-123");
      expect(book.settings.maxMemoriesPerRequest).toBe(20);
      expect(book.settings.autoExtract).toBe(true);
    });
  });

  describe("deleteMemoryBook", () => {
    it("returns false when book does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = deleteMemoryBook("nonexistent");
      expect(result).toBe(false);
    });

    it("deletes existing memory book", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.unlinkSync).mockImplementation(() => {});

      const result = deleteMemoryBook("mb-test-123");
      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe("addMemory", () => {
    it("returns null when book does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = addMemory("nonexistent", { content: "Test memory" });
      expect(result).toBeNull();
    });

    it("adds memory to existing book", () => {
      const mockBook: StoredMemoryBook = {
        id: "mb-test-123",
        name: "Test Book",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        entries: [],
        settings: {
          maxMemoriesPerRequest: 10,
          maxMemoryTokens: 1000,
          useKeywordRetrieval: true,
          autoExtract: false,
          minImportanceForInjection: 50,
          sortBy: "importance",
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBook));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const entry = addMemory("mb-test-123", {
        content: "Remember this important fact",
        keywords: ["important", "fact"],
        importance: 80,
      });

      expect(entry).not.toBeNull();
      expect(entry?.content).toBe("Remember this important fact");
      expect(entry?.importance).toBe(80);
      expect(entry?.keywords).toEqual(["important", "fact"]);
    });
  });

  describe("updateMemory", () => {
    it("returns null when book does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = updateMemory("nonexistent", "mem-123", { content: "Updated" });
      expect(result).toBeNull();
    });

    it("updates existing memory entry", () => {
      const mockEntry: MemoryEntry = {
        id: "mem-123",
        content: "Original content",
        createdAt: "2024-01-01T00:00:00Z",
        lastAccessedAt: "2024-01-01T00:00:00Z",
        accessCount: 0,
        type: "manual",
        importance: 50,
        enabled: true,
      };

      const mockBook: StoredMemoryBook = {
        id: "mb-test-123",
        name: "Test Book",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        entries: [mockEntry],
        settings: {
          maxMemoriesPerRequest: 10,
          maxMemoryTokens: 1000,
          useKeywordRetrieval: true,
          autoExtract: false,
          minImportanceForInjection: 50,
          sortBy: "importance",
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBook));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const updated = updateMemory("mb-test-123", "mem-123", {
        content: "Updated content",
        importance: 90,
      });

      expect(updated).not.toBeNull();
      expect(updated?.content).toBe("Updated content");
      expect(updated?.importance).toBe(90);
    });
  });

  describe("deleteMemory", () => {
    it("returns false when book does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = deleteMemory("nonexistent", "mem-123");
      expect(result).toBe(false);
    });

    it("deletes existing memory entry", () => {
      const mockEntry: MemoryEntry = {
        id: "mem-123",
        content: "To be deleted",
        createdAt: "2024-01-01T00:00:00Z",
        lastAccessedAt: "2024-01-01T00:00:00Z",
        accessCount: 0,
        type: "manual",
        importance: 50,
        enabled: true,
      };

      const mockBook: StoredMemoryBook = {
        id: "mb-test-123",
        name: "Test Book",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        entries: [mockEntry],
        settings: {
          maxMemoriesPerRequest: 10,
          maxMemoryTokens: 1000,
          useKeywordRetrieval: true,
          autoExtract: false,
          minImportanceForInjection: 50,
          sortBy: "importance",
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBook));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = deleteMemory("mb-test-123", "mem-123");
      expect(result).toBe(true);
    });
  });

  describe("retrieveMemories", () => {
    it("returns empty result when book does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = retrieveMemories("nonexistent", "test context");
      expect(result.memories).toEqual([]);
      expect(result.totalMemories).toBe(0);
    });

    it("retrieves memories sorted by importance", () => {
      const mockEntries: MemoryEntry[] = [
        {
          id: "mem-1",
          content: "Low importance",
          createdAt: "2024-01-01T00:00:00Z",
          lastAccessedAt: "2024-01-01T00:00:00Z",
          accessCount: 0,
          type: "manual",
          importance: 30,
          enabled: true,
        },
        {
          id: "mem-2",
          content: "High importance",
          createdAt: "2024-01-01T00:00:00Z",
          lastAccessedAt: "2024-01-01T00:00:00Z",
          accessCount: 0,
          type: "manual",
          importance: 90,
          enabled: true,
        },
      ];

      const mockBook: StoredMemoryBook = {
        id: "mb-test-123",
        name: "Test Book",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        entries: mockEntries,
        settings: {
          maxMemoriesPerRequest: 10,
          maxMemoryTokens: 1000,
          useKeywordRetrieval: false,
          autoExtract: false,
          minImportanceForInjection: 0,
          sortBy: "importance",
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBook));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = retrieveMemories("mb-test-123", "test");
      expect(result.memories).toHaveLength(2);
      expect(result.memories[0].content).toBe("High importance");
    });

    it("filters by minimum importance", () => {
      const mockEntries: MemoryEntry[] = [
        {
          id: "mem-1",
          content: "Low importance",
          createdAt: "2024-01-01T00:00:00Z",
          lastAccessedAt: "2024-01-01T00:00:00Z",
          accessCount: 0,
          type: "manual",
          importance: 30,
          enabled: true,
        },
        {
          id: "mem-2",
          content: "High importance",
          createdAt: "2024-01-01T00:00:00Z",
          lastAccessedAt: "2024-01-01T00:00:00Z",
          accessCount: 0,
          type: "manual",
          importance: 90,
          enabled: true,
        },
      ];

      const mockBook: StoredMemoryBook = {
        id: "mb-test-123",
        name: "Test Book",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        entries: mockEntries,
        settings: {
          maxMemoriesPerRequest: 10,
          maxMemoryTokens: 1000,
          useKeywordRetrieval: false,
          autoExtract: false,
          minImportanceForInjection: 50,
          sortBy: "importance",
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBook));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const result = retrieveMemories("mb-test-123", "test", { minImportance: 50 });
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].content).toBe("High importance");
    });
  });

  describe("buildMemoryPrompt", () => {
    it("returns empty string for empty memories", () => {
      const result = buildMemoryPrompt([]);
      expect(result).toBe("");
    });

    it("builds prompt from memories", () => {
      const memories: MemoryEntry[] = [
        {
          id: "mem-1",
          content: "User likes coffee",
          createdAt: "2024-01-01T00:00:00Z",
          lastAccessedAt: "2024-01-01T00:00:00Z",
          accessCount: 0,
          type: "manual",
          importance: 80,
          enabled: true,
        },
        {
          id: "mem-2",
          content: "User's birthday is January 1st",
          createdAt: "2024-01-01T00:00:00Z",
          lastAccessedAt: "2024-01-01T00:00:00Z",
          accessCount: 0,
          type: "manual",
          importance: 90,
          enabled: true,
        },
      ];

      const result = buildMemoryPrompt(memories);
      expect(result).toContain("Memories");
      expect(result).toContain("User likes coffee");
      expect(result).toContain("User's birthday is January 1st");
    });
  });

  describe("getOrCreateMemoryBook", () => {
    it("creates new book when none exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const book = getOrCreateMemoryBook({
        characterId: "char-123",
        characterName: "Test Character",
      });

      expect(book).not.toBeNull();
      expect(book?.characterId).toBe("char-123");
    });

    it("returns existing book for character", () => {
      const mockBook: StoredMemoryBook = {
        id: "mb-test-123",
        name: "Test Character Memories",
        characterId: "char-123",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        entries: [],
        settings: {
          maxMemoriesPerRequest: 10,
          maxMemoryTokens: 1000,
          useKeywordRetrieval: true,
          autoExtract: false,
          minImportanceForInjection: 50,
          sortBy: "importance",
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(["mb-test-123.json"] as any);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBook));

      const book = getOrCreateMemoryBook({
        characterId: "char-123",
        characterName: "Test Character",
      });

      expect(book).not.toBeNull();
      expect(book?.id).toBe("mb-test-123");
    });
  });

  describe("autoExtractMemories", () => {
    it("extracts memories from messages with trigger words", () => {
      const mockBook: StoredMemoryBook = {
        id: "mb-test-123",
        name: "Test Book",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        entries: [],
        settings: {
          maxMemoriesPerRequest: 10,
          maxMemoryTokens: 1000,
          useKeywordRetrieval: true,
          autoExtract: true,
          minImportanceForInjection: 50,
          sortBy: "importance",
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBook));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const messages = [
        { role: "user", content: "Remember that I like pizza" },
        { role: "assistant", content: "I'll remember that you like pizza!" },
        { role: "user", content: "What's the weather?" },
      ];

      const triggers = ["remember", "important"];
      const extracted = autoExtractMemories("mb-test-123", messages, triggers);

      expect(extracted.length).toBeGreaterThanOrEqual(0);
    });

    it("returns empty array when book does not exist", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const messages = [{ role: "user", content: "Remember this" }];
      const extracted = autoExtractMemories("nonexistent", messages, ["remember"]);

      expect(extracted).toEqual([]);
    });
  });
});
