export function requireLearningOutboxDatabase() {
  const value = process.env.AB45_TEST_DATABASE_URL;
  if (!value)
    throw new Error(
      "AB45_TEST_DATABASE_URL is required; native outbox checks are unavailable without a disposable loopback database",
    );
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid disposable test database URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !/^\/ab45_[a-z0-9_]+$/.test(url.pathname)
  ) {
    throw new Error("Only disposable loopback databases named ab45_* are allowed");
  }
  return value;
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href)
  requireLearningOutboxDatabase();
