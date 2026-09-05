import { Client, estypes } from "@elastic/elasticsearch";
import { env } from "../config/env";

export const esClient = new Client({ node: env.elasticsearchUrl });

export const EMAILS_INDEX = "emails";

export async function ensureEmailsIndex() {
  const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
  if (!exists) {
    await esClient.indices.create({
      index: EMAILS_INDEX,
      mappings: {
        properties: {
          userId: { type: "keyword" },
          recipientEmail: { type: "text" },
          subject: { type: "text" },
          bodySnippet: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
        },
      },
    });
  }
}

export interface EmailDoc {
  userId: string;
  recipientEmail: string;
  subject: string;
  bodySnippet: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}

export async function indexEmail(id: string, doc: EmailDoc) {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id,
      document: doc,
      refresh: "wait_for",
    });
  } catch (err) {
    console.error("[elasticsearch] failed to index email", id, err);
  }
}

export async function searchEmails(userId: string, query: string, status?: string) {
  const filter: estypes.QueryDslQueryContainer[] = [{ term: { userId } }];
  if (status) {
    filter.push({ term: { status } });
  }
  const result = await esClient.search({
    index: EMAILS_INDEX,
    query: {
      bool: {
        filter,
        must: query
          ? [
              {
                multi_match: {
                  query,
                  fields: ["recipientEmail", "subject", "bodySnippet"],
                },
              },
            ]
          : [{ match_all: {} }],
      },
    },
    size: 100,
    sort: [{ scheduledAt: { order: "desc" } }],
  });
  return result.hits.hits.map((hit) => ({ id: hit._id, ...(hit._source as EmailDoc) }));
}
