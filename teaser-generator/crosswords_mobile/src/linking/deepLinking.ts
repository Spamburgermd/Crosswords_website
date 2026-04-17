/**
 * src/linking/deepLinking.ts
 * ---------------------------------------------
 * Parse app-specific deep links for serverless challenge/result codes.
 *
 * Supported formats (examples):
 * - myapp://c/<code>           (legacy challenge)
 * - myapp://r/<code>           (legacy result)
 * - myapp://offer/<code>       (swap-list offer)
 * - myapp://return/<code>      (swap-list return)
 * - myapp://challenge?code=<code> (legacy query)
 * - myapp://result?code=<code>    (legacy query)
 * - myapp://offer?code=<code> / myapp://return?code=<code>
 *
 * Returns { kind, code } when valid; { kind:null } when unrecognized.
 */

export type ParsedDeepLink =
  | { kind: 'challenge'; code: string }
  | { kind: 'result'; code: string }
  | { kind: 'offer'; code: string }
  | { kind: 'return'; code: string }
  | { kind: null; code?: undefined };

type ParsedDeepLinkKind = Exclude<ParsedDeepLink['kind'], null>;

function decodeMaybe(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseDeepLink(url: string | null | undefined): ParsedDeepLink {
  if (!url) return { kind: null };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: null };
  }

  const path = parsed.pathname.replace(/^\/+/, ''); // drop leading slash
  const hostPath = `${parsed.host}/${path}`.replace(/\/+$/, '');

  // Path style: myapp://c/<code> or myapp://r/<code> or myapp://offer/<code> etc.
  const pathParts = path.split('/').filter(Boolean);
  if (pathParts.length === 1) {
    const maybeCode = decodeMaybe(pathParts[0]);
    if (parsed.host === 'c' || pathParts[0] === 'c') {
      return maybeCode ? { kind: 'challenge', code: maybeCode } : { kind: null };
    }
    if (parsed.host === 'r' || pathParts[0] === 'r') {
      return maybeCode ? { kind: 'result', code: maybeCode } : { kind: null };
    }
    if (parsed.host === 'offer' || pathParts[0] === 'offer') {
      return maybeCode ? { kind: 'offer', code: maybeCode } : { kind: null };
    }
    if (parsed.host === 'return' || pathParts[0] === 'return') {
      return maybeCode ? { kind: 'return', code: maybeCode } : { kind: null };
    }
  }
  if (pathParts.length === 2) {
    const [kind, codeRaw] = pathParts;
    const code = decodeMaybe(codeRaw);
    if (kind === 'c' && code) return { kind: 'challenge', code };
    if (kind === 'r' && code) return { kind: 'result', code };
    if (kind === 'offer' && code) return { kind: 'offer', code };
    if (kind === 'return' && code) return { kind: 'return', code };
  }

  // Query style: myapp://challenge?code=... or myapp://result?code=... or offer/return
  const queryKind = parsed.host.toLowerCase();
  const codeParam = decodeMaybe(parsed.searchParams.get('code'));
  const isQueryKind = (
    value: string,
  ): value is ParsedDeepLinkKind =>
    value === 'challenge' || value === 'result' || value === 'offer' || value === 'return';

  if (isQueryKind(queryKind) && codeParam) {
    return { kind: queryKind, code: codeParam };
  }

  // Fallback to checking combined host/path for readability (e.g., myapp://challenge/code)
  if (hostPath.startsWith('challenge') && codeParam) {
    return { kind: 'challenge', code: codeParam };
  }
  if (hostPath.startsWith('result') && codeParam) {
    return { kind: 'result', code: codeParam };
  }
  if (hostPath.startsWith('offer') && codeParam) {
    return { kind: 'offer', code: codeParam };
  }
  if (hostPath.startsWith('return') && codeParam) {
    return { kind: 'return', code: codeParam };
  }

  return { kind: null };
}
