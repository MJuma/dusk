/** Hues for author names, spread around the wheel but skipping orange, which marks the OP. */
const HUES = [195, 215, 235, 255, 275, 295, 315, 335, 165, 145, 120, 95] as const;

/** The same hue every time for the same name, so a person is easy to follow through a thread. */
export function nameHue(name: string): number {
    // FNV-1a: cheap and spreads similar names apart.
    let hash = 2_166_136_261;
    for (let at = 0; at < name.length; at++) {
        hash ^= name.charCodeAt(at);
        hash = Math.imul(hash, 16_777_619);
    }
    return HUES[(hash >>> 0) % HUES.length] ?? HUES[0];
}
