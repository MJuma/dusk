/** Runs `task` over `inputs` with at most `limit` in flight, preserving input order in the result. */
export async function mapLimit<T, R>(inputs: readonly T[], limit: number, task: (input: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < inputs.length) {
            const index = next;
            next += 1;
            results[index] = await task(inputs[index] as T);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
    return results;
}
