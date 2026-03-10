import { getIpPrefix, handleSubmitVote, hashIpPrefix } from "./index.ts";

type QueuedResponse = {
  status: number;
  body?: unknown;
  headers?: HeadersInit;
};

type FetchCall = {
  method: string;
  url: string;
  body: unknown;
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      message ?? `Expected ${String(expected)} but received ${String(actual)}`,
    );
  }
}

function createJsonResponse(status: number, body: unknown): QueuedResponse {
  return {
    status,
    body,
    headers: { "Content-Type": "application/json" },
  };
}

function createFetchMock(queue: QueuedResponse[]) {
  const calls: FetchCall[] = [];

  const mockFetch: typeof fetch = async (
    input: Request | URL | string,
    init?: RequestInit,
  ) => {
    const request = input instanceof Request ? input : null;
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

    const method = init?.method ?? request?.method ?? "GET";

    const rawBody = typeof init?.body === "string"
      ? init.body
      : request
      ? await request.clone().text()
      : "";

    let parsedBody: unknown = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }

    calls.push({ method, url, body: parsedBody });

    const nextResponse = queue.shift();
    if (!nextResponse) {
      throw new Error(`Unexpected fetch call for ${method} ${url}`);
    }

    const serializedBody = nextResponse.body === undefined
      ? null
      : JSON.stringify(nextResponse.body);

    return new Response(serializedBody, {
      status: nextResponse.status,
      headers: nextResponse.headers,
    });
  };

  return { mockFetch, calls };
}

async function withMockedFetch<T>(
  mockFetch: typeof fetch,
  fn: () => Promise<T>,
): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  Object.defineProperty(globalThis, "fetch", {
    value: mockFetch,
    writable: true,
    configurable: true,
  });

  try {
    return await fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "fetch", descriptor);
    }
  }
}

async function withEnv<T>(
  updates: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous: Record<string, string | undefined> = {};

  for (const key of Object.keys(updates)) {
    previous[key] = Deno.env.get(key) ?? undefined;
    const nextValue = updates[key];
    if (nextValue === undefined) {
      Deno.env.delete(key);
    } else {
      Deno.env.set(key, nextValue);
    }
  }

  try {
    return await fn();
  } finally {
    for (const key of Object.keys(updates)) {
      const priorValue = previous[key];
      if (priorValue === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, priorValue);
      }
    }
  }
}

function getInsertedRow(body: unknown): Record<string, unknown> {
  if (Array.isArray(body)) {
    return (body[0] ?? {}) as Record<string, unknown>;
  }
  return (body ?? {}) as Record<string, unknown>;
}

Deno.test("getIpPrefix handles IPv4 and canonicalizes leading zeros", () => {
  assertEquals(getIpPrefix("192.168.1.42"), "192.168.1");
  assertEquals(getIpPrefix("192.168.001.042"), "192.168.1");
  assertEquals(getIpPrefix(" 255.010.000.001 "), "255.10.0");
  assertEquals(getIpPrefix("999.10.10.10"), null);
});

Deno.test("getIpPrefix handles IPv6 loopback/compressed/leading-zero forms", () => {
  assertEquals(getIpPrefix("::1"), "0000:0000:0000:0000");

  assertEquals(
    getIpPrefix("2001:0db8:0000:0000:0000:ff00:0042:8329"),
    "2001:0db8:0000:0000",
  );

  assertEquals(
    getIpPrefix("2001:db8::ff00:42:8329"),
    "2001:0db8:0000:0000",
  );

  assertEquals(getIpPrefix("[2001:db8::1]"), "2001:0db8:0000:0000");
  assertEquals(getIpPrefix("2001:::1"), null);
  assertEquals(getIpPrefix("2001:db8::zzzz"), null);
});

Deno.test(
  "submit vote success stores hashed IP prefix and fingerprint via mocked fetch",
  async () => {
    const secret = "test-secret";

    await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        VOTE_HMAC_SECRET: secret,
      },
      async () => {
        const { mockFetch, calls } = createFetchMock([
          createJsonResponse(406, {
            code: "PGRST116",
            details: "Results contain 0 rows",
            hint: null,
            message: "JSON object requested, multiple (or no) rows returned",
          }),
          createJsonResponse(406, {
            code: "PGRST116",
            details: "Results contain 0 rows",
            hint: null,
            message: "JSON object requested, multiple (or no) rows returned",
          }),
          createJsonResponse(201, {}),
        ]);

        await withMockedFetch(mockFetch, async () => {
          const request = new Request("http://localhost/submit-vote", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": "2001:db8::ff00:42:8329, 10.0.0.1",
            },
            body: JSON.stringify({
              trackId: "track-a",
              scheduledDate: "2026-03-09",
              deviceId: "device-1",
              clientFingerprint:
                "a4f536db0d6dbfc95c4fa7f1c7782e66b7f36f384193e4ecf1530f5622ec84e9",
            }),
          });

          const response = await handleSubmitVote(request);
          const responseJson = await response.json();

          assertEquals(response.status, 200);
          assertEquals(responseJson.success, true);
          assertEquals(
            calls.length,
            3,
            "Expected combined-check read, device-check read, and one insert call",
          );

          const insertCall = calls[2];
          const insertedRow = getInsertedRow(insertCall.body);
          const expectedIpHash = await hashIpPrefix(
            "2001:0db8:0000:0000",
            secret,
          );
          const expectedFingerprintHash = await hashIpPrefix(
            "a4f536db0d6dbfc95c4fa7f1c7782e66b7f36f384193e4ecf1530f5622ec84e9",
            secret,
          );

          assertEquals(insertedRow.scheduled_track_id as string, "track-a");
          assertEquals(insertedRow.device_id as string, "device-1");
          assertEquals(insertedRow.ip_address as string, expectedIpHash);
          assertEquals(
            insertedRow.fingerprint_hash as string,
            expectedFingerprintHash,
          );
        });
      },
    );
  },
);

Deno.test(
  "submit vote blocks duplicate when both ip hash and fingerprint hash match",
  async () => {
    await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        VOTE_HMAC_SECRET: "test-secret",
      },
      async () => {
        const { mockFetch, calls } = createFetchMock([
          createJsonResponse(200, {
            scheduled_track_id: "existing-track",
          }),
        ]);

        await withMockedFetch(mockFetch, async () => {
          const request = new Request("http://localhost/submit-vote", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": "192.168.1.55",
            },
            body: JSON.stringify({
              trackId: "track-a",
              scheduledDate: "2026-03-09",
              deviceId: "device-1",
              clientFingerprint:
                "f3fd3b891f9f856f7e31cec41f7b0809e3ef5eca5f65a319ad4adf17de4cd7a7",
            }),
          });

          const response = await handleSubmitVote(request);
          const responseJson = await response.json();

          assertEquals(response.status, 409);
          assertEquals(responseJson.success, false);
          assertEquals(responseJson.reason, "already_voted_other_track");
          assertEquals(
            calls.length,
            1,
            "Device check and insert should not run after combined duplicate hit",
          );
        });
      },
    );
  },
);

Deno.test("submit vote blocks duplicate device vote and skips insert", async () => {
  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      VOTE_HMAC_SECRET: "test-secret",
    },
    async () => {
      const { mockFetch, calls } = createFetchMock([
        createJsonResponse(200, {
          scheduled_track_id: "different-track",
        }),
      ]);

      await withMockedFetch(mockFetch, async () => {
        const request = new Request("http://localhost/submit-vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "::1",
          },
          body: JSON.stringify({
            trackId: "track-a",
            scheduledDate: "2026-03-09",
            deviceId: "device-1",
          }),
        });

        const response = await handleSubmitVote(request);
        const responseJson = await response.json();

        assertEquals(response.status, 409);
        assertEquals(responseJson.success, false);
        assertEquals(responseJson.reason, "already_voted_other_track");
        assertEquals(calls.length, 1, "Insert should not run for duplicates");
      });
    },
  );
});

Deno.test("submit vote inserts null ip hash when VOTE_HMAC_SECRET is missing", async () => {
  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      VOTE_HMAC_SECRET: undefined,
    },
    async () => {
      const { mockFetch, calls } = createFetchMock([
        createJsonResponse(406, {
          code: "PGRST116",
          details: "Results contain 0 rows",
          hint: null,
          message: "JSON object requested, multiple (or no) rows returned",
        }),
        createJsonResponse(201, {}),
      ]);

      await withMockedFetch(mockFetch, async () => {
        const request = new Request("http://localhost/submit-vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "192.168.1.55",
          },
          body: JSON.stringify({
            trackId: "track-a",
            scheduledDate: "2026-03-09",
            deviceId: "device-1",
          }),
        });

        const response = await handleSubmitVote(request);
        const responseJson = await response.json();

        assertEquals(response.status, 200);
        assertEquals(responseJson.success, true);
        assertEquals(calls.length, 2);

        const insertedRow = getInsertedRow(calls[1].body);
        assertEquals(insertedRow.ip_address as null, null);
        assertEquals(insertedRow.fingerprint_hash as null, null);
      });
    },
  );
});

Deno.test("submit vote returns bad request for malformed payload without fetch", async () => {
  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      VOTE_HMAC_SECRET: "test-secret",
    },
    async () => {
      const { mockFetch, calls } = createFetchMock([]);

      await withMockedFetch(mockFetch, async () => {
        const request = new Request("http://localhost/submit-vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trackId: "track-a",
            scheduledDate: "2026-03-09",
          }),
        });

        const response = await handleSubmitVote(request);
        const responseJson = await response.json();

        assertEquals(response.status, 400);
        assertEquals(responseJson.reason, "insert_failed");
        assertEquals(
          calls.length,
          0,
          "Supabase should not be called for invalid payloads",
        );
      });
    },
  );
});

Deno.test("fetch mock saw PostgREST song_votes endpoint", async () => {
  await withEnv(
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      VOTE_HMAC_SECRET: "test-secret",
    },
    async () => {
      const { mockFetch, calls } = createFetchMock([
        createJsonResponse(406, {
          code: "PGRST116",
          details: "Results contain 0 rows",
          hint: null,
          message: "JSON object requested, multiple (or no) rows returned",
        }),
        createJsonResponse(201, {}),
      ]);

      await withMockedFetch(mockFetch, async () => {
        const request = new Request("http://localhost/submit-vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "::1",
          },
          body: JSON.stringify({
            trackId: "track-a",
            scheduledDate: "2026-03-09",
            deviceId: "device-1",
          }),
        });

        const response = await handleSubmitVote(request);
        assertEquals(response.status, 200);

        assert(calls.length >= 1, "Expected at least one Supabase fetch call");
        assert(
          calls[0].url.includes("/rest/v1/song_votes"),
          `Expected PostgREST song_votes endpoint, received ${calls[0].url}`,
        );
      });
    },
  );
});

Deno.test(
  "submit vote is not blocked when ip hash is missing even if fingerprint matches",
  async () => {
    const secret = "test-secret";
    const sharedFingerprint =
      "ed2a4b751fef45fa6259c882c3b579fdd25626f5fd4a4ce7b698e1887258bd19";

    await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        VOTE_HMAC_SECRET: secret,
      },
      async () => {
        const { mockFetch, calls } = createFetchMock([
          createJsonResponse(406, {
            code: "PGRST116",
            details: "Results contain 0 rows",
            hint: null,
            message: "JSON object requested, multiple (or no) rows returned",
          }),
          createJsonResponse(201, {}),
          createJsonResponse(406, {
            code: "PGRST116",
            details: "Results contain 0 rows",
            hint: null,
            message: "JSON object requested, multiple (or no) rows returned",
          }),
          createJsonResponse(201, {}),
        ]);

        await withMockedFetch(mockFetch, async () => {
          const firstResponse = await handleSubmitVote(
            new Request("http://localhost/submit-vote", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                trackId: "track-a",
                scheduledDate: "2026-03-09",
                deviceId: "device-1",
                clientFingerprint: sharedFingerprint,
              }),
            }),
          );
          const firstResponseJson = await firstResponse.json();

          const secondResponse = await handleSubmitVote(
            new Request("http://localhost/submit-vote", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                trackId: "track-b",
                scheduledDate: "2026-03-09",
                deviceId: "device-2",
                clientFingerprint: sharedFingerprint,
              }),
            }),
          );
          const secondResponseJson = await secondResponse.json();

          assertEquals(firstResponse.status, 200);
          assertEquals(firstResponseJson.success, true);
          assertEquals(secondResponse.status, 200);
          assertEquals(secondResponseJson.success, true);

          const firstInsertRow = getInsertedRow(calls[1].body);
          const secondInsertRow = getInsertedRow(calls[3].body);
          const expectedFingerprintHash = await hashIpPrefix(
            sharedFingerprint,
            secret,
          );

          assertEquals(firstInsertRow.ip_address as null, null);
          assertEquals(secondInsertRow.ip_address as null, null);
          assertEquals(
            firstInsertRow.fingerprint_hash as string,
            expectedFingerprintHash,
          );
          assertEquals(
            secondInsertRow.fingerprint_hash as string,
            expectedFingerprintHash,
          );
        });
      },
    );
  },
);
