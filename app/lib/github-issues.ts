import { validateMindMap } from "./mindmap";
import type { MindMapDocument, ValidationResult } from "./mindmap";

export const GITHUB_OWNER = "Zhaoiii";
export const GITHUB_REPOSITORY = "zhijian-mindmap";
export const ISSUE_TITLE_PREFIX = "[mindmap]";
export const ISSUE_PAYLOAD_MARKER = "<!-- zhijian-mindmap:v1 -->";

export interface GitHubIssueMapEntry {
  number: number;
  title: string;
  body: string;
  htmlUrl: string;
  updatedAt: string;
}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ownerLogin(value: unknown): boolean {
  return typeof value === "string" && value.toLowerCase() === GITHUB_OWNER.toLowerCase();
}

export function parseIssueMapEntry(input: unknown): GitHubIssueMapEntry | null {
  if (!isObject(input) || isObject(input.pull_request)) return null;
  if (typeof input.number !== "number" || !Number.isInteger(input.number) || input.number <= 0) return null;
  if (typeof input.title !== "string" || !input.title.toLowerCase().startsWith(ISSUE_TITLE_PREFIX)) return null;
  if (typeof input.html_url !== "string" || typeof input.updated_at !== "string") return null;
  if (!isObject(input.user) || !ownerLogin(input.user.login)) return null;

  const title = input.title.slice(ISSUE_TITLE_PREFIX.length).trim() || `脑图 #${input.number}`;
  return {
    number: input.number,
    title,
    body: typeof input.body === "string" ? input.body : "",
    htmlUrl: input.html_url,
    updatedAt: input.updated_at,
  };
}

export function createIssuePayload(map: MindMapDocument): string {
  return `${ISSUE_PAYLOAD_MARKER}\n\n\`\`\`json\n${JSON.stringify(map, null, 2)}\n\`\`\``;
}

export function extractMindMapPayload(body: string): ValidationResult {
  const markerIndex = body.indexOf(ISSUE_PAYLOAD_MARKER);
  const source = markerIndex >= 0 ? body.slice(markerIndex + ISSUE_PAYLOAD_MARKER.length) : body;
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? source).trim();
  if (!candidate) return { ok: false, error: "Issue 中没有脑图 JSON" };

  try {
    return validateMindMap(JSON.parse(candidate) as unknown);
  } catch {
    return { ok: false, error: "Issue 中的脑图 JSON 无法解析" };
  }
}

export function latestOwnerMindMap(comments: unknown): ValidationResult {
  if (!Array.isArray(comments)) return { ok: false, error: "Issue 评论响应格式不正确" };
  for (let index = comments.length - 1; index >= 0; index -= 1) {
    const comment = comments[index];
    if (!isObject(comment) || !isObject(comment.user) || !ownerLogin(comment.user.login) || typeof comment.body !== "string") continue;
    const checked = extractMindMapPayload(comment.body);
    if (checked.ok) return checked;
  }
  return { ok: false, error: `没有找到由 ${GITHUB_OWNER} 发布的有效脑图版本` };
}

export function issueListApiUrl(): string {
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/issues?state=open&per_page=100`;
}

export function issueCommentsApiUrl(issueNumber: number, page = 1): string {
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/issues/${issueNumber}/comments?per_page=100&page=${page}`;
}

export function issueSaveUrl(issueNumber: number | null, title: string): string {
  if (issueNumber) return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/issues/${issueNumber}#new_comment_field`;
  const params = new URLSearchParams({ title: `${ISSUE_TITLE_PREFIX} ${title || "未命名脑图"}` });
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/issues/new?${params.toString()}`;
}

export function lastPageFromLink(link: string | null): number {
  if (!link) return 1;
  const match = link.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? Math.max(1, Number(match[1])) : 1;
}
