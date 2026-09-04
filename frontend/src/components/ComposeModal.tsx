"use client";

import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import type { Sender, ScheduleResult } from "@/types";

export const EMAILS_SCHEDULED_EVENT = "emails:scheduled";

export function ComposeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [showAddSender, setShowAddSender] = useState(false);
  const [newSender, setNewSender] = useState({ name: "", email: "", smtpUser: "", smtpPass: "" });
  const [savingSender, setSavingSender] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [startTime, setStartTime] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get<Sender[]>("/api/senders")
      .then((data) => {
        setSenders(data);
        if (data.length && !senderId) setSenderId(data[0].id);
      })
      .catch(() => toast.push("Could not load senders", "error"));

    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    setStartTime(now.toISOString().slice(0, 16));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleAddSender() {
    setSavingSender(true);
    try {
      const created = await api.post<Sender>("/api/senders", newSender);
      setSenders((prev) => [...prev, created]);
      setSenderId(created.id);
      setShowAddSender(false);
      setNewSender({ name: "", email: "", smtpUser: "", smtpPass: "" });
      toast.push("Sender added");
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Failed to add sender", "error");
    } finally {
      setSavingSender(false);
    }
  }

  function handleFile(f: File | null) {
    setFile(f);
    if (!f) {
      setDetectedCount(null);
      return;
    }
    f.text().then((text) => {
      const matches = text.match(/[^\s,;<>()]+@[^\s,;<>()]+\.[^\s,;<>()]+/g) ?? [];
      setDetectedCount(new Set(matches.map((m) => m.toLowerCase())).size);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !senderId) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("senderId", senderId);
      formData.append("subject", subject);
      formData.append("body", body);
      formData.append("startTime", new Date(startTime).toISOString());
      formData.append("delayMs", String(delaySeconds * 1000));
      formData.append("hourlyLimit", String(hourlyLimit));
      formData.append("file", file);

      const result = await api.post<ScheduleResult>("/api/emails/schedule", formData);
      toast.push(`Scheduled ${result.recipientCount} email(s)`);
      window.dispatchEvent(new CustomEvent(EMAILS_SCHEDULED_EVENT));
      onClose();
      setSubject("");
      setBody("");
      setFile(null);
      setDetectedCount(null);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Failed to schedule emails", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Compose New Email">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">From sender</label>
          <div className="flex gap-2">
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              required
            >
              <option value="" disabled>
                {senders.length ? "Select a sender" : "No senders configured yet"}
              </option>
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} &lt;{s.email}&gt;
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={() => setShowAddSender((v) => !v)}>
              + Sender
            </Button>
          </div>

          {showAddSender && (
            <div className="mt-3 space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">
                Add an Ethereal test account (create one free at{" "}
                <a href="https://ethereal.email/create" target="_blank" rel="noreferrer" className="underline">
                  ethereal.email
                </a>
                ).
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Display name"
                  value={newSender.name}
                  onChange={(e) => setNewSender((s) => ({ ...s, name: e.target.value }))}
                />
                <Input
                  placeholder="From email"
                  value={newSender.email}
                  onChange={(e) => setNewSender((s) => ({ ...s, email: e.target.value }))}
                />
                <Input
                  placeholder="SMTP user"
                  value={newSender.smtpUser}
                  onChange={(e) => setNewSender((s) => ({ ...s, smtpUser: e.target.value }))}
                />
                <Input
                  type="password"
                  placeholder="SMTP password"
                  value={newSender.smtpPass}
                  onChange={(e) => setNewSender((s) => ({ ...s, smtpPass: e.target.value }))}
                />
              </div>
              <Button type="button" onClick={handleAddSender} disabled={savingSender}>
                {savingSender ? "Saving…" : "Save sender"}
              </Button>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="Subject" />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Body</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={4}
            placeholder="Write your email…"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Leads file (CSV or TXT)</label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            required
            className="w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
          />
          {detectedCount !== null && (
            <p className="mt-1 text-xs text-gray-500">{detectedCount} email address(es) detected</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Start time</label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Delay (sec)</label>
            <Input
              type="number"
              min={0}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Hourly limit</label>
            <Input
              type="number"
              min={1}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !senders.length}>
            {submitting ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
