export interface ReleaseMetadata {
  version: string;
  buildNumber: number;
  releaseId: string | null;
  builtAt: string | null;
}

export function renderReleaseHtml(html: string, release: ReleaseMetadata): string {
  const payload = JSON.stringify(release).replaceAll('<', '\\u003c');
  let rendered = html
    .replace(/(<span\b[^>]*\bid="settingsAppVersion">)[^<]*(<\/span>)/, (_, start, end) => start + release.version + end)
    .replace(/(<span\b[^>]*\bid="settingsBuildNumber">)[^<]*(<\/span>)/, (_, start, end) => start + release.buildNumber + end)
    .replace(/(<script\b[^>]*\bid="siteReleaseMetadata"[^>]*>)[\s\S]*?(<\/script>)/, (_, start, end) => start + payload + end);
  if (release.releaseId) {
    rendered = rendered.replace(/((?:src|href)="[^"?]+\.(?:js|css))(?:\?[^\"]*)?"/g,
      (_, url) => `${url}?v=${release.releaseId!.slice(0, 16)}"`);
  }
  return rendered;
}
