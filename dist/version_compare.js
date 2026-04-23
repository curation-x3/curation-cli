/**
 * True if `a` is strictly greater than `b` (numeric semver segments, e.g. 0.1.4 > 0.1.3).
 */
export function versionGreater(a, b) {
    const seg = (s) => s.split(".").map((p) => parseInt(p, 10) || 0);
    const pa = seg(a);
    const pb = seg(b);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
        const x = pa[i] ?? 0;
        const y = pb[i] ?? 0;
        if (x > y)
            return true;
        if (x < y)
            return false;
    }
    return false;
}
//# sourceMappingURL=version_compare.js.map