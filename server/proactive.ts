import OpenAI from "openai";
import pool from "./db";
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

function getWIBParts(): { year: number; month: number; day: number; hour: number; minute: number; second: number; dayOfWeek: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0", 10);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === 24 ? 0 : get("hour");
  const minute = get("minute");
  const second = get("second");
  const wibDate = new Date(year, month - 1, day);
  const dayOfWeek = wibDate.getDay();
  return { year, month, day, hour, minute, second, dayOfWeek };
}

function getWIBDate(): Date {
  const p = getWIBParts();
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

function getWIBDateString(): string {
  const p = getWIBParts();
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function getWIBTimeString(): string {
  const p = getWIBParts();
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function getWIBHour(): number {
  return getWIBParts().hour;
}

function getWIBDayName(): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[getWIBParts().dayOfWeek];
}

export { getWIBDate, getWIBDateString, getWIBTimeString, getWIBHour, getWIBDayName, parseWIBTimestamp };

async function createNotification(data: { type: string; title: string; message: string; data?: string | null }): Promise<number> {
  const id = await dbCreateNotification(data);
  sendPushToAll(data.title, data.message).catch(() => {});
  return id;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function todayKey(): string {
  return getWIBDateString();
}

async function getInsightCountToday(): Promise<number> {
  const count = await getSetting(`insight_count_${todayKey()}`);
  return count ? parseInt(count, 10) : 0;
}

async function incrementInsightCount() {
  const current = await getInsightCountToday();
  await setSetting(`insight_count_${todayKey()}`, String(current + 1));
}

async function hasSentNotifToday(type: string): Promise<boolean> {
  const key = `notif_${type}_${todayKey()}`;
  return (await getSetting(key)) === "1";
}

async function markNotifSent(type: string) {
  const key = `notif_${type}_${todayKey()}`;
  await setSetting(key, "1");
}

function parseWIBTimestamp(dateTimeStr: string): Date {
  const cleaned = dateTimeStr.replace(/\s+/g, " ").trim();
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  if (match) {
    const [, y, mo, d, h, mi] = match;
    const wibDate = new Date(Date.UTC(+y, +mo - 1, +d, +h - 7, +mi));
    return wibDate;
  }
  return new Date(dateTimeStr);
}

export async function checkMeetingReminders() {
  try {
    const upcoming = await getUpcomingMeetings();
    const now = Date.now();

    for (const meeting of upcoming) {
      if (!meeting.date_time) continue;

      const meetingTime = parseWIBTimestamp(meeting.date_time);
      const diffMinutes = (meetingTime.getTime() - now) / (1000 * 60);

      if (diffMinutes < -60) {
        try {
          await pool.query(`UPDATE meetings SET status = 'completed' WHERE id = $1 AND status = 'scheduled'`, [meeting.id]);
        } catch {}
        continue;
      }

      if (!meeting.notify) continue;

      if (diffMinutes > 0 && diffMinutes <= 35) {
        const reminderKey = `meeting_reminder_${meeting.id}_${meeting.date_time}`;
        if ((await getSetting(reminderKey)) === "1") continue;

        const minutesLeft = Math.round(diffMinutes);
        await createNotification({
          type: "meeting_reminder",
          title: `Meeting dalam ${minutesLeft} menit`,
          message: `${meeting.title}${meeting.participants ? ` — Peserta: ${meeting.participants}` : ""}${meeting.agenda ? ` — Agenda: ${meeting.agenda}` : ""}`,
          data: JSON.stringify({ meeting_id: meeting.id }),
        });
        await setSetting(reminderKey, "1");
        console.log(`Proactive: meeting reminder sent for "${meeting.title}" (WIB)`);
      }
    }
  } catch (err: any) {
    console.error("Meeting reminder check failed:", err?.message || err);
  }
}

export async function checkOverdueItems() {
  try {
    if (await hasSentNotifToday("overdue_check")) return;

    const overdue = await getOverdueActionItems();
    if (overdue.length === 0) return;

    const items = overdue.slice(0, 5).map(a => {
      let text = `${a.title}`;
      if (a.assignee) text += ` (${a.assignee})`;
      if (a.deadline) text += ` — deadline: ${a.deadline}`;
      return text;
    });

    await createNotification({
      type: "overdue_alert",
      title: `${overdue.length} action item overdue`,
      message: items.join("\n"),
      data: JSON.stringify({ count: overdue.length }),
    });
    await markNotifSent("overdue_check");
    console.log(`Proactive: overdue alert sent (${overdue.length} items)`);
  } catch (err: any) {
    console.error("Overdue check failed:", err?.message || err);
  }
}

export async function checkProjectDeadlines() {
  try {
    if (await hasSentNotifToday("project_deadline")) return;

    const projects = await getProjects("active");
    const todayStr = getWIBDateString();
    const todayMs = new Date(todayStr + "T00:00:00Z").getTime();
    const warnings: string[] = [];

    for (const p of projects) {
      if (!p.deadline) continue;
      const deadlineMs = new Date(p.deadline + "T00:00:00Z").getTime();
      const daysLeft = Math.ceil((deadlineMs - todayMs) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0 && daysLeft <= 3) {
        warnings.push(`${p.name} — deadline ${daysLeft} hari lagi${p.progress ? ` (progress: ${p.progress}%)` : ""}`);
      }
    }

    if (warnings.length > 0) {
      await createNotification({
        type: "project_deadline",
        title: `${warnings.length} project mendekati deadline`,
        message: warnings.join("\n"),
      });
      await markNotifSent("project_deadline");
      console.log(`Proactive: project deadline warning sent`);
    }
  } catch (err: any) {
    console.error("Project deadline check failed:", err?.message || err);
  }
}

export async function generateDailyBriefing() {
  try {
    if (await hasSentNotifToday("daily_briefing")) return;

    const hour = getWIBHour();
    if (hour < 6 || hour > 9) return;

    const todayMeetings = await getTodayMeetings();
    const pending = await getPendingActionItems();
    const overdue = await getOverdueActionItems();
    const activeProjects = await getProjects("active");
    const teamList = await getTeamMembers("active");
    const teamCount = teamList.length;

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

    await createNotification({
      type: "daily_briefing",
      title: "Daily Briefing",
      message: `Mas DR, ${parts.join(". ")}.`,
    });
    await markNotifSent("daily_briefing");
    console.log("Proactive: daily briefing sent");
  } catch (err: any) {
    console.error("Daily briefing failed:", err?.message || err);
  }
}

export async function generateProactiveInsight() {
  try {
    const insightCount = await getInsightCountToday();
    if (insightCount >= 3) return;

    const hour = getWIBHour();
    if (hour < 8 || hour > 20) return;

    const minInterval = await getSetting(`last_insight_time`);
    if (minInterval) {
      const lastTime = new Date(minInterval);
      const hoursSince = (Date.now() - lastTime.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 4) return;
    }

    const teamMembers = await getTeamMembers("active");
    const projects = await getProjects("active");
    const pending = await getPendingActionItems();
    const overdue = await getOverdueActionItems();
    const meetings = await getUpcomingMeetings();
    const tags = await getConversationTags("mas_dr", 20);

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

    await createNotification({
      type: "darvis_insight",
      title: "DARVIS Insight",
      message: insight,
    });
    await incrementInsightCount();
    await setSetting("last_insight_time", new Date().toISOString());
    console.log(`Proactive: DARVIS insight generated (${insightCount + 1}/3 today)`);
  } catch (err: any) {
    console.error("Proactive insight failed:", err?.message || err);
  }
}

async function aggressiveCleanup() {
  try {
    await cleanupOldNotifications(24);

    const r1 = await pool.query(`
      DELETE FROM notifications WHERE type = 'meeting_reminder' AND created_at::timestamp < NOW() - INTERVAL '1 hours'
    `);

    const r2 = await pool.query(`
      DELETE FROM notifications WHERE read = 1 AND type NOT IN ('darvis_insight') AND created_at::timestamp < NOW() - INTERVAL '2 hours'
    `);

    const r3 = await pool.query(`
      DELETE FROM notifications WHERE type IN ('overdue_alert', 'meeting_reminder') AND created_at::timestamp < NOW() - INTERVAL '3 hours'
    `);

    const r4 = await pool.query(`
      DELETE FROM notifications WHERE created_at::timestamp < NOW() - INTERVAL '12 hours'
    `);

    const cleaned = (r1.rowCount || 0) + (r2.rowCount || 0) + (r3.rowCount || 0) + (r4.rowCount || 0);
    if (cleaned > 0) {
      console.log(`Cleanup: removed ${cleaned} old notifications`);
    }

    const overdueResult = await pool.query(`
      UPDATE action_items SET status = 'cancelled' WHERE status = 'pending' AND deadline IS NOT NULL AND deadline::date < CURRENT_DATE - INTERVAL '3 days'
    `);
    if ((overdueResult.rowCount || 0) > 0) {
      console.log(`Cleanup: auto-cancelled ${overdueResult.rowCount} overdue action items (3+ days past deadline)`);
    }

    const deleteOldCancelled = await pool.query(`
      DELETE FROM action_items WHERE status IN ('cancelled', 'done') AND updated_at::timestamp < NOW() - INTERVAL '14 days'
    `);
    if ((deleteOldCancelled.rowCount || 0) > 0) {
      console.log(`Cleanup: purged ${deleteOldCancelled.rowCount} old cancelled/done action items (14+ days)`);
    }

    const completedMeetings = await pool.query(`
      DELETE FROM meetings WHERE status = 'completed' AND date_time IS NOT NULL AND date_time::timestamp < NOW() - INTERVAL '7 days'
    `);
    if ((completedMeetings.rowCount || 0) > 0) {
      console.log(`Cleanup: auto-deleted ${completedMeetings.rowCount} completed meetings (7+ days old)`);
    }
  } catch (err: any) {
    console.error("Aggressive cleanup failed:", err?.message || err);
  }
}

export function startProactiveSystem() {
  console.log("Proactive system started (WIB timezone)");

  setInterval(() => {
    checkMeetingReminders();
    aggressiveCleanup();
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

  setTimeout(() => {
    aggressiveCleanup();
    checkMeetingReminders();
    checkOverdueItems();
    checkProjectDeadlines();
    generateDailyBriefing();
  }, 10 * 1000);

  setTimeout(() => {
    generateProactiveInsight();
  }, 30 * 1000);
}
