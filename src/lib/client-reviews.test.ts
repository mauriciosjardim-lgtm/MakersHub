import { describe, expect, test } from "bun:test";
import { extractGoogleDriveFileId, getReviewEmbedUrl } from "./client-reviews";

describe("preview de vídeo do portal", () => {
  test("gera preview para Drive, Vimeo e formatos comuns do YouTube", () => {
    expect(getReviewEmbedUrl("https://drive.google.com/file/d/arquivo123/view")).toBe(
      "https://drive.google.com/file/d/arquivo123/preview",
    );
    expect(getReviewEmbedUrl("https://vimeo.com/123456")).toBe(
      "https://player.vimeo.com/video/123456",
    );
    expect(getReviewEmbedUrl("https://youtu.be/abc_DEF-123?t=2")).toBe(
      "https://www.youtube.com/embed/abc_DEF-123",
    );
    expect(getReviewEmbedUrl("https://www.youtube.com/watch?v=abc_DEF-123&feature=share")).toBe(
      "https://www.youtube.com/embed/abc_DEF-123",
    );
  });

  test("recusa protocolos e domínios que apenas imitam um provedor", () => {
    expect(getReviewEmbedUrl("javascript:alert(1)//player.vimeo.com/video/123")).toBeNull();
    expect(getReviewEmbedUrl("https://youtube.com.evil.example/watch?v=abc")).toBeNull();
    expect(getReviewEmbedUrl("texto sem URL")).toBeNull();
  });

  test("extrai o id de links alternativos do Drive", () => {
    expect(extractGoogleDriveFileId("https://drive.google.com/open?id=arquivo-42")).toBe(
      "arquivo-42",
    );
  });
});
