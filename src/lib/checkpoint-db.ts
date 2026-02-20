import { Pool } from "pg";
import { decode, ExtensionCodec } from "@msgpack/msgpack";

// ─── Singleton Pool ──────────────────────────────────────────────────────────

let pool: Pool | null = null;

function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!pool) {
    // Strip sslmode from the URL so pg doesn't override our explicit ssl config
    const cleanUrl = url.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");
    pool = new Pool({
      connectionString: cleanUrl,
      max: 5,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

// ─── Msgpack Extension Codec ─────────────────────────────────────────────────
// LangGraph's JsonPlusSerializer uses ormsgpack Extension Types to encode
// Python objects (e.g. LangChain HumanMessage, AIMessage). We decode them
// into their plain kwargs dicts so they're usable on the JS side.

const extensionCodec = new ExtensionCodec();

// EXT_CONSTRUCTOR_SINGLE (type 0): encoded as [module_path, single_arg]
extensionCodec.register({
  type: 0,
  encode: () => new Uint8Array(0), // not needed
  decode: (data: Uint8Array) => {
    const [, value] = decode(data, { extensionCodec }) as [string, unknown];
    return value;
  },
});

// EXT_CONSTRUCTOR_KWARGS (type 1): encoded as [module_path, kwargs_dict]
extensionCodec.register({
  type: 1,
  encode: () => new Uint8Array(0),
  decode: (data: Uint8Array) => {
    const [, kwargs] = decode(data, { extensionCodec }) as [
      string,
      Record<string, unknown>,
    ];
    return kwargs;
  },
});

function decodeMsgpack(buf: Buffer): unknown {
  return decode(buf, { extensionCodec });
}

// ─── Load Thread State ───────────────────────────────────────────────────────

/**
 * Query the LangGraph checkpoint tables directly and reconstruct the thread's
 * channel_values (the agent state). Returns `null` when DATABASE_URL is unset
 * or no checkpoint exists for `threadId`.
 */
export async function loadThreadState(
  threadId: string,
): Promise<Record<string, unknown> | null> {
  const db = getPool();
  if (!db) return null;

  // This mirrors LangGraph's SELECT_SQL: fetch the latest checkpoint for the
  // thread and JOIN checkpoint_blobs via the channel_versions map.
  const { rows } = await db.query(
    `SELECT
       checkpoint,
       (
         SELECT array_agg(array[bl.channel::bytea, bl.type::bytea, bl.blob])
         FROM jsonb_each_text(checkpoint -> 'channel_versions') cv
         INNER JOIN checkpoint_blobs bl
           ON bl.thread_id  = checkpoints.thread_id
          AND bl.checkpoint_ns = checkpoints.checkpoint_ns
          AND bl.channel     = cv.key
          AND bl.version     = cv.value
       ) AS channel_values
     FROM checkpoints
     WHERE thread_id = $1 AND checkpoint_ns = ''
     ORDER BY checkpoint_id DESC
     LIMIT 1`,
    [threadId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  const checkpoint = row.checkpoint as {
    channel_values?: Record<string, unknown>;
  };

  // Start with the inline primitives stored directly in the checkpoint JSONB.
  const state: Record<string, unknown> = {
    ...(checkpoint.channel_values ?? {}),
  };

  // Merge in the blob-stored channel values.
  const blobRows = row.channel_values as Buffer[][] | null;
  if (blobRows) {
    for (const triple of blobRows) {
      const channel = triple[0].toString("utf-8");
      const type = triple[1].toString("utf-8");
      const blob = triple[2];

      try {
        if (type === "msgpack" && blob) {
          state[channel] = decodeMsgpack(blob);
        } else if (type === "json" && blob) {
          state[channel] = JSON.parse(blob.toString("utf-8"));
        } else if (type === "bytes" && blob) {
          state[channel] = blob;
        }
        // "empty" / "null" → skip (channel was cleared)
      } catch {
        // If a channel fails to decode (e.g. pickle), skip it gracefully.
      }
    }
  }

  return state;
}

// ─── List Thread IDs ─────────────────────────────────────────────────────────

export async function listThreadIds(): Promise<string[]> {
  const db = getPool();
  if (!db) return [];

  const { rows } = await db.query(
    "SELECT DISTINCT thread_id FROM checkpoints ORDER BY thread_id",
  );
  return rows.map((r) => r.thread_id as string);
}
