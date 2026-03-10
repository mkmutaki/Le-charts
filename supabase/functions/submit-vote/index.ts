import { createClient } from "npm:@supabase/supabase-js@2";

type SubmitVotePayload = {
  trackId?: string;
  scheduledDate?: string;
  deviceId?: string;
  clientFingerprint?: string | null;
};

type SubmitVoteFailureReason =
  | "already_voted_same_track"
  | "already_voted_other_track"
  | "insert_failed";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeIpInput(ipAddress: string): string {
  const trimmedIp = ipAddress.trim().toLowerCase();
  const ipWithoutZone = trimmedIp.split("%")[0];

  if (ipWithoutZone.startsWith("[")) {
    const closingBracketIndex = ipWithoutZone.indexOf("]");
    if (closingBracketIndex > 1) {
      return ipWithoutZone.slice(1, closingBracketIndex);
    }
  }

  return ipWithoutZone;
}

function parseIpv4Octets(ipAddress: string): number[] | null {
  const octets = ipAddress.split(".");
  if (octets.length !== 4) {
    return null;
  }

  const parsedOctets: number[] = [];
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) {
      return null;
    }

    const value = Number(octet);
    if (value < 0 || value > 255) {
      return null;
    }

    parsedOctets.push(value);
  }

  return parsedOctets;
}

function normalizeIpv6EmbeddedIpv4(ipAddress: string): string | null {
  if (!ipAddress.includes(".")) {
    return ipAddress;
  }

  const lastColonIndex = ipAddress.lastIndexOf(":");
  if (lastColonIndex === -1) {
    return null;
  }

  const ipv4Part = ipAddress.slice(lastColonIndex + 1);
  const octets = parseIpv4Octets(ipv4Part);
  if (!octets) {
    return null;
  }

  const firstHextet = ((octets[0] << 8) | octets[1]).toString(16);
  const secondHextet = ((octets[2] << 8) | octets[3]).toString(16);
  return `${ipAddress.slice(0, lastColonIndex)}:${firstHextet}:${secondHextet}`;
}

function parseIpv6Hextets(ipAddress: string): number[] | null {
  if (!ipAddress.includes(":")) {
    return null;
  }

  const normalizedIpv6 = normalizeIpv6EmbeddedIpv4(ipAddress);
  if (!normalizedIpv6) {
    return null;
  }

  const compressionParts = normalizedIpv6.split("::");
  if (compressionParts.length > 2) {
    return null;
  }

  const parseHextetPart = (part: string): number[] | null => {
    if (!part) {
      return [];
    }

    const groups = part.split(":");
    const parsedGroups: number[] = [];

    for (const group of groups) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) {
        return null;
      }
      parsedGroups.push(Number.parseInt(group, 16));
    }

    return parsedGroups;
  };

  const leftGroups = parseHextetPart(compressionParts[0] ?? "");
  const rightGroups = parseHextetPart(compressionParts[1] ?? "");

  if (!leftGroups || !rightGroups) {
    return null;
  }

  if (compressionParts.length === 1) {
    return leftGroups.length === 8 ? leftGroups : null;
  }

  const zeroGroupsToInsert = 8 - (leftGroups.length + rightGroups.length);
  if (zeroGroupsToInsert <= 0) {
    return null;
  }

  return [
    ...leftGroups,
    ...new Array(zeroGroupsToInsert).fill(0),
    ...rightGroups,
  ];
}

export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  return null;
}

export function getIpPrefix(ipAddress: string): string | null {
  const normalizedIp = normalizeIpInput(ipAddress);

  const ipv4Octets = parseIpv4Octets(normalizedIp);
  if (ipv4Octets) {
    return ipv4Octets.slice(0, 3).join(".");
  }

  const ipv6Hextets = parseIpv6Hextets(normalizedIp);
  if (ipv6Hextets) {
    return ipv6Hextets
      .slice(0, 4)
      .map((hextet) => hextet.toString(16).padStart(4, "0"))
      .join(":");
  }

  return null;
}

export async function hashIpPrefix(
  ipPrefix: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(ipPrefix),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getVoteHmacSecret(secretOverride?: string | null): string | null {
  const secret = secretOverride !== undefined
    ? secretOverride
    : Deno.env.get("VOTE_HMAC_SECRET") ?? null;
  if (!secret) {
    console.warn("VOTE_HMAC_SECRET is missing, storing null hash values");
    return null;
  }
  return secret;
}

function normalizeClientFingerprint(
  clientFingerprint: string | null | undefined,
): string | null {
  if (typeof clientFingerprint !== "string") {
    return null;
  }

  const trimmedFingerprint = clientFingerprint.trim();
  return trimmedFingerprint.length > 0 ? trimmedFingerprint : null;
}

export async function deriveIpHash(
  request: Request,
  secretOverride?: string | null,
): Promise<string | null> {
  const clientIp = getClientIp(request);
  if (!clientIp) {
    return null;
  }

  const ipPrefix = getIpPrefix(clientIp);
  if (!ipPrefix) {
    return null;
  }

  const secret = secretOverride !== undefined
    ? secretOverride
    : getVoteHmacSecret();
  if (!secret) {
    return null;
  }

  return hashIpPrefix(ipPrefix, secret);
}

export async function deriveFingerprintHash(
  clientFingerprint: string | null | undefined,
  secretOverride?: string | null,
): Promise<string | null> {
  const normalizedFingerprint = normalizeClientFingerprint(clientFingerprint);
  if (!normalizedFingerprint) {
    return null;
  }

  const secret = secretOverride !== undefined
    ? secretOverride
    : getVoteHmacSecret();
  if (!secret) {
    return null;
  }

  return hashIpPrefix(normalizedFingerprint, secret);
}

function failureResponse(
  reason: SubmitVoteFailureReason,
  status: number,
): Response {
  return jsonResponse({ success: false, reason }, status);
}

export async function handleSubmitVote(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return failureResponse("insert_failed", 400);
  }

  let payload: SubmitVotePayload;
  try {
    payload = await request.json() as SubmitVotePayload;
  } catch {
    return failureResponse("insert_failed", 400);
  }

  const trackId = payload.trackId;
  const scheduledDate = payload.scheduledDate;
  const deviceId = payload.deviceId;
  const clientFingerprint = payload.clientFingerprint;

  if (!trackId || !scheduledDate || !deviceId) {
    return failureResponse("insert_failed", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing Supabase function environment variables");
    return failureResponse("insert_failed", 400);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const voteHmacSecret = getVoteHmacSecret();
  const ipHash = await deriveIpHash(request, voteHmacSecret);
  const fingerprintHash = await deriveFingerprintHash(
    clientFingerprint,
    voteHmacSecret,
  );

  if (ipHash && fingerprintHash) {
    const { data: existingCombinedSignalVote, error: combinedCheckError } =
      await supabase
        .from("song_votes")
        .select("scheduled_track_id")
        .eq("scheduled_date", scheduledDate)
        .eq("ip_address", ipHash)
        .eq("fingerprint_hash", fingerprintHash)
        .not("scheduled_track_id", "is", null)
        .maybeSingle();

    if (combinedCheckError) {
      console.error(
        "Failed to check existing vote using IP + fingerprint hash:",
        combinedCheckError,
      );
      return failureResponse("insert_failed", 400);
    }

    if (existingCombinedSignalVote?.scheduled_track_id) {
      return failureResponse("already_voted_other_track", 409);
    }
  }

  const { data: existingVote, error: checkError } = await supabase
    .from("song_votes")
    .select("scheduled_track_id")
    .eq("device_id", deviceId)
    .eq("scheduled_date", scheduledDate)
    .not("scheduled_track_id", "is", null)
    .maybeSingle();

  if (checkError) {
    console.error("Failed to check existing vote:", checkError);
    return failureResponse("insert_failed", 400);
  }

  if (existingVote?.scheduled_track_id) {
    if (existingVote.scheduled_track_id === trackId) {
      return failureResponse("already_voted_same_track", 409);
    }
    return failureResponse("already_voted_other_track", 409);
  }

  const { error: insertError } = await supabase
    .from("song_votes")
    .insert({
      scheduled_track_id: trackId,
      scheduled_date: scheduledDate,
      device_id: deviceId,
      ip_address: ipHash,
      fingerprint_hash: fingerprintHash,
    });

  if (insertError) {
    console.error("Failed to insert vote:", insertError);
    return failureResponse("insert_failed", 400);
  }

  return jsonResponse({ success: true });
}

if (import.meta.main) {
  Deno.serve(handleSubmitVote);
}
