export interface Me {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  slackConnected: boolean;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export type EmailStatus = "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";

export interface EmailRow {
  id: string;
  email: string;
  subject: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  error: string | null;
}

export interface ScheduleResult {
  batchId: string;
  jobCount: number;
  recipientCount: number;
}
