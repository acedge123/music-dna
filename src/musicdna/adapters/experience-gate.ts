// Called only by the server entry; this gate is not authentication.
export function allowExperienceRequest(
  request: Request,
  config: { enabled?: string; acceptance?: string; harnessKey?: string },
) {
  const path = new URL(request.url).pathname;
  const needsV1 =
    path.startsWith("/api/v1/") &&
    (request.headers.get("x-musicdna-experience") === "1" ||
      /\/session\/[^/]+\/(chat|feedback|share)$/.test(path));
  if (!needsV1 || config.enabled === "1") return true;
  const supplied = request.headers.get("x-musicdna-acceptance-key");
  return config.acceptance === "1" && Boolean(config.harnessKey) && supplied === config.harnessKey;
}
