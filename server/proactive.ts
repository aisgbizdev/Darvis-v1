import OpenAI from "openai";
import db from "./db";
import { cleanupOldNotifications } from "./db";
import {
  getTeamMembers,
  getMeetings,
  getUpcomingMeetings,
  getTodayMeetings,
  getOverdueActionItems,
  getPendingActionItems,
  getProjects,
  createNotification as dbCreateNotification,
  getNotifications,
  getConversationTags,
  getSetting,
  setSetting,
} from "./db";
import { sendPushToAll } from "./push";

function createNotification(data: { type: string; title: string; message: string; data?: string | null }): number {
  const id = dbCreateNotification(data);
  sendPushToAll(data.title, data.message).catch(() => {});
  return id;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function getInsightCountToday(): number {
  const count = getSetting(`insight_count_${todayKey()}`);
  return count ? parseInt(count, 10) : 0;
}

function incrementInsightCount() {
  const current = getInsightCountToday();
  setSetting(`insight_count_${todayKey()}`, String(current + 1));
}

function hasSentNotifToday(type: string): boolean {
  const key = `notif_${type}_${todayKey()}`;
  return getSetting(key) === "1";
}

function markNotifSent(type: string) {
  const key = `notif_${type}_${todayKey()}`;
  setSetting(key, "1");
}

export function checkMeetingReminders() {
  try {
    const upcoming = getUpcomingMeetings();
    const now = new Date();

    for (const meeting of upcoming) {
      if (!meeting.date_time) continue;

      const meetingTime = new Date(meeting.date_time);
      const diffMinutes = (meetingTime.getTime() - now.getTime()) / (1000 * 60);

      if (diffMinutes < -60) {
        try {
          db.prepare(`UPDATE meetings SET status = 'completed' WHERE id = ? AND status = 'scheduled'`).run(meeting.id);
        } catch {}
        continue;
      }

      if (diffMinutes > 0 && diffMinutes <= 35) {
        const reminderKey = `meeting_reminder_${meeting.id}_${meeting.date_time}`;
        if (getSetting(reminderKey) === "1") continue;

        const minutesLeft = Math.round(diffMinutes);
        createNotification({
          type: "meeting_reminder",
          title: `Meeting dalam ${minutesLeft} menit`,
          message: `${meeting.title}${meeting.participants ? ` — Peserta: ${meeting.participants}` : ""}${meeting.agenda ? ` — Agenda: ${meeting.agenda}` : ""}`,
          data: JSON.stringify({ meeting_id: meeting.id }),
        });
        setSetting(reminderKey, "1");
        console.log(`Proactive: meeting reminder sent for "${meeting.title}"`);
      }
    }
  } catch (err: any) {
    console.error("Meeting reminder check failed:", err?.message || err);
  }
}

export function checkOverdueItems() {
  try {
    if (hasSentNotifToday("overdue_check")) return;

    const overdue = getOverdueActionItems();
    if (overdue.length === 0) return;

    const items = overdue.slice(0, 5).map(a => {
      let text = `${a.title}`;
      if (a.assignee) text += ` (${a.assignee})`;
      if (a.deadline) text += ` — deadline: ${a.deadline}`;
      return text;
    });

    createNotification({
      type: "overdue_alert",
      title: `${overdue.length} action item overdue`,
      message: items.join("\n"),
      data: JSON.stringify({ count: overdue.length }),
    });
    markNotifSent("overdue_check");
    console.log(`Proactive: overdue alert sent (${overdue.length} items)`);
  } catch (err: any) {
    console.error("Overdue check failed:", err?.message || err);
  }
}

export function checkProjectDeadlines() {
  try {
    if (hasSentNotifToday("project_deadline")) return;

    const projects = getProjects("active");
    const now = new Date();
    const warnings: string[] = [];

    for (const p of projects) {
      if (!p.deadline) continue;
      const deadline = new Date(p.deadline);
      const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0 && daysLeft <= 3) {
        warnings.push(`${p.name} — deadline ${daysLeft} hari lagi${p.progress ? ` (progress: ${p.progress}%)` : ""}`);
      }
    }

    if (warnings.length > 0) {
      createNotification({
        type: "project_deadline",
        title: `${warnings.length} project mendekati deadline`,
        message: warnings.join("\n"),
      });
      markNotifSent("project_deadline");
      console.log(`Proactive: project deadline warning sent`);
    }
  } catch (err: any) {
    console.error("Project deadline check failed:", err?.message || err);
  }
}

export function generateDailyBriefing() {
  try {
    if (hasSentNotifToday("daily_briefing")) return;

    const hour = new Date().getHours();
    if (hour < 6 || hour > 9) return;

    const todayMeetings = getTodayMeetings();
    const pending = getPendingActionItems();
    const overdue = getOverdueActionItems();
    const activeProjects = getProjects("active");
    const teamCount = getTeamMembers("active").length;

    const parts: string[] = [];
    if (todayMeetings.length > 0) {
      parts.push(`${todayMeetings.length} meeting hari ini: ${todayMeetings.map(m => m.title).join(", ")}`);
    }
    if (overdue.length > 0) {
      parts.push(`${overdue.length} action item overdue`);
    }
    if (pending.length > 0) {
      parts.push(`${pending.length} action item pending`);
    }
    if (activeProjects.length > 0) {
      parts.push(`${activeProjects.length} project aktif`);
    }

    if (parts.length === 0) {
      parts.push("Tidak ada item mendesak hari ini. Jadwal clear.");
    }

    createNotification({
      type: "daily_briefing",
      title: "Daily Briefing",
      message: `Mas DR, ${parts.join(". ")}.`,
    });
    markNotifSent("daily_briefing");
    console.log("Proactive: daily briefing sent");
  } catch (err: any) {
    console.error("Daily briefing failed:", err?.message || err);
  }
}

export async function generateProactiveInsight() {
  try {
    const insightCount = getInsightCountToday();
    if (insightCount >= 3) return;

    const hour = new Date().getHours();
    if (hour < 8 || hour > 20) return;

    const minInterval = getSetting(`last_insight_time`);
    if (minInterval) {
      const lastTime = new Date(minInterval);
      const hoursSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 4) return;
    }

    const teamMembers = getTeamMembers("active");
    const projects = getProjects("active");
    const pending = getPendingActionItems();
    const overdue = getOverdueActionItems();
    const meetings = getUpcomingMeetings();
    const tags = getConversationTags("mas_dr", 20);

    if (teamMembers.length === 0 && projects.length === 0 && pending.length === 0) return;

    const dataContext = [
      teamMembers.length > 0 ? `Tim (${teamMembers.length}): ${teamMembers.map(m => `${m.name} (${m.position || "no pos"})`).join(", ")}` : "",
      projects.length > 0 ? `Project aktif (${projects.length}): ${projects.map(p => `${p.name} [${p.status}, ${p.progress || 0}%]`).join(", ")}` : "",
      pending.length > 0 ? `Action items pending: ${pending.length} (${pending.slice(0, 5).map(a => `${a.title} → ${a.assignee || "?"}`).join(", ")})` : "",
      overdue.length > 0 ? `OVERDUE: ${overdue.length} item` : "",
      meetings.length > 0 ? `Meeting mendatang: ${meetings.slice(0, 3).map(m => m.title).join(", ")}` : "",
      tags.length > 0 ? `Pola percakapan terakhir: ${tags.slice(0, 5).map(t => t.context_mode).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `Kamu adalah DARVIS, asisten strategis untuk mas DR (CBD Solid Group). Berdasarkan data berikut, berikan SATU insight yang actionable dan berharga.

DATA:
${dataContext}

RULES:
- Tulis insight dalam bahasa Indonesia, santai tapi substantif (kayak sparring partner)
- Fokus pada hal yang BISA DITINDAKLANJUTI, bukan observasi umum
- Contoh jenis insight:
  * Pola delegasi yang tidak seimbang
  * Project yang butuh perhatian lebih
  * Tim member yang mungkin overload atau underutilized
  * Risiko dari action items yang tertunda terlalu lama
  * Koneksi antar project/tim yang belum dimanfaatkan
- Maksimal 2-3 kalimat
- Mulai dengan konteks singkat, lalu insight, lalu saran aksi
- Jangan terlalu formal, jangan terlalu santai

Respond ONLY with the insight text, nothing else.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 300,
    });

    const insight = completion.choices[0]?.message?.content?.trim();
    if (!insight) return;

    createNotification({
      type: "darvis_insight",
      title: "DARVIS Insight",
      message: insight,
    });
    incrementInsightCount();
    setSetting("last_insight_time", new Date().toISOString());
    console.log(`Proactive: DARVIS insight generated (${insightCount + 1}/3 today)`);
  } catch (err: any) {
    console.error("Proactive insight failed:", err?.message || err);
  }
}

export function startProactiveSystem() {
  console.log("Proactive system started");

  setInterval(() => {
    checkMeetingReminders();
  }, 5 * 60 * 1000);

  setInterval(() => {
    checkOverdueItems();
    checkProjectDeadlines();
  }, 30 * 60 * 1000);

  setInterval(() => {
    generateDailyBriefing();
  }, 15 * 60 * 1000);

  setInterval(() => {
    generateProactiveInsight();
  }, 60 * 60 * 1000);

  setInterval(() => {
    cleanupOldNotifications(24);
  }, 60 * 60 * 1000);

  setTimeout(() => {
    cleanupOldNotifications(24);
    checkMeetingReminders();
    checkOverdueItems();
    checkProjectDeadlines();
    generateDailyBriefing();
  }, 10 * 1000);

  setTimeout(() => {
    generateProactiveInsight();
  }, 30 * 1000);
}
