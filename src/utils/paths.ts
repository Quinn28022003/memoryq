import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

/**
 * Canonicalizes a file path relative to a project root.
 * - Normalizes separators and removes redundant . and .. segments.
 * - If inside the root, returns a repo-relative path (e.g. "src/index.ts").
 * - If outside the root, returns an absolute path.
 */
export function canonicalizePath(filePath: string, rootDir: string): string {
    const normalized = normalize(filePath);
    const absolutePath = isAbsolute(normalized) ? normalized : resolve(rootDir, normalized);
    const relativePath = relative(rootDir, absolutePath);

    // If relativePath starts with '..' or is absolute (on windows if on different drive),
    // it's outside the root.
    if (relativePath.startsWith(`..${sep}`) || relativePath === "..") {
        return absolutePath;
    }

    if (isAbsolute(relativePath)) {
        return relativePath;
    }

    // Ensure forward slashes for cross-platform consistency in the database
    return relativePath.split(sep).join("/");
}
