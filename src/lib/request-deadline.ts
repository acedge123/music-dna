// A timeout means an unknown outcome, never proof that a write failed.
export async function withRequestDeadline<T>(
  request: Promise<T>,
  message: string,
  milliseconds = 45000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}