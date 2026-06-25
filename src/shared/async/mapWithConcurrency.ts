/**
 * Map over items running at most `limit` async tasks at once, preserving input
 * order in the returned array. Used to bound concurrency when fanning out
 * external calls (e.g. per-work OpenAlex fetches) so we neither serialize them
 * nor flood the upstream with N simultaneous requests.
 */
export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    if (limit <= 0) {
        throw new Error("mapWithConcurrency: limit must be > 0");
    }
    if (items.length === 0) {
        return [];
    }

    const results = new Array<R>(items.length);
    let cursor = 0;

    const runWorker = async (): Promise<void> => {
        while (true) {
            const index = cursor;
            cursor += 1;
            if (index >= items.length) {
                return;
            }
            results[index] = await fn(items[index] as T, index);
        }
    };

    const workerCount = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    return results;
}
