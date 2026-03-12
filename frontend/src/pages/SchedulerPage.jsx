import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import GlassTile from "@/components/ui/glass-tile";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Users,
  DollarSign,
  Repeat,
  Check,
  X,
  HelpCircle,
  Play,
  Sparkles,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// ── Quick Schedule Tile Presets ──────────────────────────────────
const QUICK_TILES = [
  { id: "fri-poker",   title: "Friday Night Poker",  subtitle: "Every Friday",  day: 5, time: "19:00", game: "poker",   buyIn: 20, tag: "Popular",    tone: "amber",  icon: "\u2660" },
  { id: "sat-rummy",   title: "Saturday Rummy",      subtitle: "Every Saturday", day: 6, time: "20:00", game: "rummy",   buyIn: 15, tag: "Classic",    tone: "mint",   icon: "\u2666" },
  { id: "sun-spades",  title: "Sunday Spades",       subtitle: "Every Sunday",   day: 0, time: "18:00", game: "spades",  buyIn: 10, tag: "Chill",      tone: "purple", icon: "\u2663" },
  { id: "custom",      title: "Custom Game Night",   subtitle: "Your rules",     day: null, time: null, game: "other",   buyIn: null, tag: "Custom", tone: "rose",   icon: "\u2665" },
];

const GAME_TYPES = [
  { value: "poker", label: "Poker" },
  { value: "rummy", label: "Rummy" },
  { value: "blackjack", label: "Blackjack" },
  { value: "spades", label: "Spades" },
  { value: "hearts", label: "Hearts" },
  { value: "bridge", label: "Bridge" },
  { value: "other", label: "Other" },
];

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Just this once" },
  { value: "weekly", label: "Every week" },
  { value: "biweekly", label: "Every 2 weeks" },
];

const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h % 12 || 12;
    const ampm = h < 12 ? "AM" : "PM";
    const min = m.toString().padStart(2, "0");
    TIME_OPTIONS.push({
      value: `${h.toString().padStart(2, "0")}:${min}`,
      label: `${hour}:${min} ${ampm}`,
    });
  }
}

const DAY_CHIPS = [
  { label: "Sun", day: 0 },
  { label: "Mon", day: 1 },
  { label: "Tue", day: 2 },
  { label: "Wed", day: 3 },
  { label: "Thu", day: 4 },
  { label: "Fri", day: 5 },
  { label: "Sat", day: 6 },
];

const STATUS_COLORS = {
  accepted: "bg-emerald-500",
  declined: "bg-red-500",
  maybe: "bg-amber-500",
  invited: "bg-slate-400",
};

// Tone-matched gradient buttons
const TONE_BUTTONS = {
  amber:  "linear-gradient(135deg, #EE6C29, #C45A22)",
  mint:   "linear-gradient(135deg, #22C55E, #16A34A)",
  purple: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
  rose:   "linear-gradient(135deg, #F43F5E, #E11D48)",
};

// Tone header gradient zones
const TONE_HEADERS = {
  amber:  "linear-gradient(135deg, rgba(245,158,11,0.25), rgba(238,108,41,0.10))",
  mint:   "linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.10))",
  purple: "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(99,102,241,0.10))",
  rose:   "linear-gradient(135deg, rgba(244,63,94,0.25), rgba(236,72,153,0.10))",
};

function getNextDayOfWeek(dayIndex) {
  const now = new Date();
  const current = now.getDay();
  let diff = dayIndex - current;
  if (diff <= 0) diff += 7;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next;
}

// ── Main Component ───────────────────────────────────────────────
export default function SchedulerPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  // Data
  const [groups, setGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState("");

  // Create sheet state
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTile, setActiveTile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [selectedTime, setSelectedTime] = useState("19:00");
  const [recurrence, setRecurrence] = useState("none");
  const [gameCategory, setGameCategory] = useState("poker");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [buyIn, setBuyIn] = useState("");
  const [duration, setDuration] = useState("180");
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState([]);

  // Event detail sheet state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);
  const [detailInvites, setDetailInvites] = useState([]);
  const [detailStats, setDetailStats] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rsvpSubmitting, setRsvpSubmitting] = useState(null);
  const [startingGame, setStartingGame] = useState(false);

  // Stagger animation
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const stagger = (i) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0) scale(1)" : "translateY(16px) scale(0.98)",
    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${i * 70}ms`,
  });

  // ── Fetch groups & events ──────────────────────────────────────
  useEffect(() => {
    axios.get(`${API}/groups`).then((res) => {
      const g = res.data || [];
      setGroups(g);
      if (g.length > 0 && !selectedGroupId) {
        setSelectedGroupId(g[0].group_id);
      }
    }).catch(() => {});
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = selectedGroupId ? `?group_id=${selectedGroupId}` : "";
      const res = await axios.get(`${API}/events${params}`);
      setEvents(res.data?.events || res.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedGroupId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (!selectedGroupId) { setMembers([]); return; }
    axios.get(`${API}/groups/${selectedGroupId}/members`).then((res) => {
      setMembers(res.data?.members || res.data || []);
    }).catch(() => setMembers([]));
  }, [selectedGroupId]);

  // ── Open create sheet from tile ────────────────────────────────
  const openCreateSheet = (tile) => {
    setActiveTile(tile);
    setTitle(tile.title);
    setGameCategory(tile.game || "poker");
    setBuyIn(tile.buyIn != null ? String(tile.buyIn) : "");
    setSelectedTime(tile.time || "19:00");
    setRecurrence("none");
    setLocation("");
    setDuration("180");
    if (tile.day != null) {
      setSelectedDate(getNextDayOfWeek(tile.day));
    } else {
      setSelectedDate(undefined);
    }
    setCreateOpen(true);
  };

  // ── Submit event ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedDate || !selectedGroupId) {
      toast.error("Please select a group and date.");
      return;
    }
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const startsAt = new Date(selectedDate);
    startsAt.setHours(hours, minutes, 0, 0);

    try {
      setSubmitting(true);
      await axios.post(`${API}/events`, {
        group_id: selectedGroupId,
        title: title || "Game Night",
        starts_at: startsAt.toISOString(),
        duration_minutes: parseInt(duration) || 180,
        location: location || null,
        game_category: gameCategory,
        recurrence,
        default_buy_in: buyIn ? parseFloat(buyIn) : null,
        invite_scope: "group",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      });
      toast.success(t.scheduler?.eventCreated || "Game scheduled! Invites sent.");
      setCreateOpen(false);
      fetchEvents();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to create event";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open event detail sheet ────────────────────────────────────
  const openDetailSheet = async (event) => {
    setDetailEvent(event);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailInvites([]);
    setDetailStats(null);
    try {
      const res = await axios.get(`${API}/occurrences/${event.occurrence_id}/invites`);
      setDetailInvites(res.data.invites || []);
      setDetailStats(res.data.stats || null);
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  };

  // ── RSVP handler ───────────────────────────────────────────────
  const handleRsvp = async (status) => {
    if (!detailEvent) return;
    try {
      setRsvpSubmitting(status);
      const res = await axios.post(`${API}/occurrences/${detailEvent.occurrence_id}/rsvp`, { status });
      if (res.data.stats) setDetailStats(res.data.stats);
      setEvents((prev) =>
        prev.map((e) =>
          e.occurrence_id === detailEvent.occurrence_id ? { ...e, my_rsvp: status } : e
        )
      );
      setDetailEvent((prev) => prev ? { ...prev, my_rsvp: status } : prev);
      const messages = {
        accepted: t.scheduler?.rsvpAccepted || "You're in! See you there.",
        declined: t.scheduler?.rsvpDeclined || "Got it. We'll miss you!",
        maybe: t.scheduler?.rsvpMaybe || "Noted. We'll keep your spot.",
      };
      toast.success(messages[status] || "Response recorded.");
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to RSVP";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setRsvpSubmitting(null);
    }
  };

  // ── Start game handler ─────────────────────────────────────────
  const handleStartGame = async () => {
    if (!detailEvent) return;
    try {
      setStartingGame(true);
      const res = await axios.post(`${API}/occurrences/${detailEvent.occurrence_id}/start-game`);
      toast.success(t.scheduler?.gameStarted || "Game started!");
      setDetailOpen(false);
      navigate(`/games/${res.data.game_id}`);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to start game";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setStartingGame(false);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "";
    return new Date(isoStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    return new Date(isoStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const selectedGroup = groups.find((g) => g.group_id === selectedGroupId);
  const isHost = (event) => event.host_id === user?.user_id;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="lab-bg text-slate-100 min-h-screen">

      {/* Atmospheric gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] left-[10%] w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #A855F7, transparent 65%)" }} />
        <div className="absolute bottom-[5%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #EE6C29, transparent 65%)" }} />
        <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, #22C55E, transparent 65%)" }} />
      </div>

      <main className="relative max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Back */}
        <div style={stagger(0)} className="mb-5">
          <button
            onClick={() => navigate(-1)}
            className="text-xs px-3 py-1.5 rounded-full glass-chip cursor-pointer text-slate-400 hover:text-orange-400"
          >
            &larr; Back
          </button>
        </div>

        {/* Header */}
        <div style={stagger(1)} className="mb-8">
          <p className="font-dot text-[11px] tracking-[0.3em] uppercase text-slate-500 mb-2">
            SCHEDULE
          </p>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none text-slate-100">
              Game Night
            </h1>
            {/* Group selector */}
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-[180px] glass-surface border-white/[0.08] text-slate-300">
                <Users className="w-4 h-4 mr-2 text-orange-400/60" />
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.group_id} value={g.group_id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-4 h-px" style={{ background: "linear-gradient(90deg, rgba(168,85,247,0.4), rgba(238,108,41,0.3), transparent)" }} />
        </div>

        {/* ── Upcoming Games ──────────────────────────────────── */}
        {events.length > 0 && (
          <div style={stagger(2)} className="mb-8">
            <p className="font-dot text-[10px] tracking-[0.2em] uppercase text-slate-500 mb-3">
              UPCOMING
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {events.map((event) => (
                <GlassTile
                  key={event.occurrence_id || event.event_id}
                  size="sm"
                  elevated
                  onClick={() => openDetailSheet(event)}
                  className="min-w-[160px] max-w-[180px] shrink-0 cursor-pointer"
                >
                  <p className="font-dot text-[9px] tracking-[0.15em] uppercase text-orange-400/60 mb-1">
                    {formatDate(event.starts_at)}
                  </p>
                  <p className="font-medium text-sm text-slate-100 truncate mb-0.5">
                    {event.title}
                  </p>
                  <p className="text-xs text-slate-500 mb-2">
                    {formatTime(event.starts_at)}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[event.my_rsvp] || STATUS_COLORS.invited}`} />
                    <span className="text-[10px] text-slate-500 capitalize">
                      {event.my_rsvp || "invited"}
                    </span>
                  </div>
                </GlassTile>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Schedule Tiles ────────────────────────────── */}
        <div style={stagger(3)} className="mb-8">
          <p className="font-dot text-[10px] tracking-[0.2em] uppercase text-slate-500 mb-3">
            QUICK SCHEDULE
          </p>

          {!selectedGroupId ? (
            <GlassTile size="md" className="text-center py-8">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                Select a group above to schedule a game
              </p>
            </GlassTile>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {QUICK_TILES.map((tile, i) => (
                <div key={tile.id} style={stagger(4 + i)}>
                  <GlassTile
                    size="lg"
                    tone={tile.tone}
                    elevated
                    onClick={() => openCreateSheet(tile)}
                    className="flex flex-col min-h-[260px] !p-0 overflow-hidden cursor-pointer"
                  >
                    {/* Gradient header zone */}
                    <div
                      className="relative px-4 pt-4 pb-6 flex flex-col justify-between"
                      style={{ background: TONE_HEADERS[tile.tone], minHeight: "110px" }}
                    >
                      <div className="flex justify-between items-start">
                        <span className="glass-chip text-[10px]">{tile.tag}</span>
                        {tile.buyIn != null && (
                          <span className="glass-chip text-[10px] font-mono font-bold">
                            ${tile.buyIn}
                          </span>
                        )}
                      </div>
                      <span className="text-5xl opacity-20 mt-2 leading-none select-none">
                        {tile.icon}
                      </span>
                    </div>

                    {/* Body */}
                    <div className="px-4 pt-3 pb-4 flex flex-col flex-1 justify-between">
                      <div>
                        <h3 className="text-xl font-bold leading-tight text-slate-100 mb-1">
                          {tile.title}
                        </h3>
                        <p className="text-sm text-slate-400">
                          {tile.subtitle}
                          {tile.time && ` \u00b7 ${TIME_OPTIONS.find((o) => o.value === tile.time)?.label || tile.time}`}
                        </p>
                      </div>

                      {/* Tone-matched button */}
                      <button
                        className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                        style={{ background: TONE_BUTTONS[tile.tone] }}
                        onClick={(e) => { e.stopPropagation(); openCreateSheet(tile); }}
                      >
                        {tile.id === "custom"
                          ? (t.scheduler?.customize || "Customize")
                          : (t.scheduler?.scheduleNow || "Schedule Now")}
                      </button>
                    </div>
                  </GlassTile>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && events.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && selectedGroupId && (
          <div style={stagger(5)}>
            <GlassTile size="md" className="text-center py-8">
              <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {t.scheduler?.noEvents || "No upcoming games. Tap a tile above to schedule one!"}
              </p>
            </GlassTile>
          </div>
        )}
      </main>

      {/* ── Create Event Bottom Sheet ────────────────────────── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto bg-background border-t border-white/[0.08]">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-xl font-bold text-slate-100">
              {activeTile?.title || "Schedule Game"}
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              {selectedGroup
                ? `Sending to ${selectedGroup.name} (${selectedGroup.member_count || members.length} members)`
                : "Configure and send invites"}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            {/* Day chips (all 7 days) */}
            <div>
              <label className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500 mb-2 block">Day</label>
              <div className="flex gap-2 flex-wrap">
                {DAY_CHIPS.map((d) => (
                  <button
                    key={d.day}
                    onClick={() => setSelectedDate(getNextDayOfWeek(d.day))}
                    className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedDate && selectedDate.getDay() === d.day
                        ? "text-white shadow-lg"
                        : "glass-chip text-slate-300 hover:text-orange-400"
                    }`}
                    style={
                      selectedDate && selectedDate.getDay() === d.day
                        ? { background: TONE_BUTTONS[activeTile?.tone || "amber"] }
                        : {}
                    }
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {selectedDate && (
                <p className="text-xs text-slate-500 mt-1.5">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </p>
              )}
            </div>

            {/* Time + Recurrence */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500 mb-1.5 block">Time</label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger className="glass-surface border-white/[0.08] text-slate-200">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-orange-400/60" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500 mb-1.5 block">Repeat</label>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger className="glass-surface border-white/[0.08] text-slate-200">
                    <Repeat className="w-3.5 h-3.5 mr-1.5 text-orange-400/60" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Game type + Title (custom only) */}
            {activeTile?.id === "custom" && (
              <>
                <div>
                  <label className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500 mb-1.5 block">Game type</label>
                  <Select value={gameCategory} onValueChange={setGameCategory}>
                    <SelectTrigger className="glass-surface border-white/[0.08] text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GAME_TYPES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500 mb-1.5 block">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Friday Night Poker"
                    className="glass-surface border-white/[0.08] text-slate-200 placeholder:text-slate-600"
                  />
                </div>
              </>
            )}

            {/* Buy-in + Duration + Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500 mb-1.5 block">Buy-in ($)</label>
                <Input
                  type="number"
                  value={buyIn}
                  onChange={(e) => setBuyIn(e.target.value)}
                  placeholder="20"
                  className="glass-surface border-white/[0.08] text-slate-200 placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500 mb-1.5 block">Duration (min)</label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="180"
                  className="glass-surface border-white/[0.08] text-slate-200 placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500 mb-1.5 block">Location (optional)</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Jake's place"
                className="glass-surface border-white/[0.08] text-slate-200 placeholder:text-slate-600"
              />
            </div>

            {/* Member preview */}
            {members.length > 0 && (
              <div>
                <label className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500 mb-2 block">
                  Sending invites to
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  {members.slice(0, 8).map((m) => (
                    <Popover key={m.user_id}>
                      <PopoverTrigger asChild>
                        <button className="w-8 h-8 rounded-full glass-surface flex items-center justify-center text-xs font-medium text-slate-300 hover:ring-2 hover:ring-orange-400/50 transition-all">
                          {(m.name || m.user_name || "?").charAt(0).toUpperCase()}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="top" className="px-3 py-1.5 text-xs w-auto">
                        {m.name || m.user_name || "Member"}
                      </PopoverContent>
                    </Popover>
                  ))}
                  {members.length > 8 && (
                    <span className="text-xs text-slate-500 ml-1">+{members.length - 8} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedDate || !selectedGroupId}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
              style={{ background: TONE_BUTTONS[activeTile?.tone || "amber"] }}
            >
              {submitting
                ? (t.common?.loading || "Scheduling...")
                : (t.scheduler?.scheduleAndInvite || "Schedule & Send Invites")}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Event Detail Bottom Sheet ──────────── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto bg-background border-t border-white/[0.08]">
          {detailEvent && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-xl font-bold text-slate-100">
                  {detailEvent.title}
                </SheetTitle>
                <SheetDescription className="text-slate-400">
                  {formatDate(detailEvent.starts_at)} at {formatTime(detailEvent.starts_at)}
                  {detailEvent.location && ` \u00b7 ${detailEvent.location}`}
                </SheetDescription>
              </SheetHeader>

              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : isHost(detailEvent) ? (
                /* Host View */
                <div className="space-y-4">
                  {detailStats && (
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Going", count: detailStats.accepted, color: "bg-emerald-500" },
                        { label: "Maybe", count: detailStats.maybe, color: "bg-amber-500" },
                        { label: "No", count: detailStats.declined, color: "bg-red-500" },
                        { label: "Waiting", count: (detailStats.invited || 0) + (detailStats.no_response || 0), color: "bg-slate-500" },
                      ].map((s) => (
                        <div key={s.label} className="text-center p-3 rounded-xl bg-white/[0.04] border border-white/[0.05]">
                          <div className={`w-2.5 h-2.5 rounded-full ${s.color} mx-auto mb-1.5`} />
                          <p className="font-mono text-2xl font-bold text-slate-100">{s.count}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="font-dot text-[10px] tracking-[0.15em] uppercase text-slate-500">Responses</p>
                    {detailInvites.map((invite) => {
                      const statusIcon = {
                        accepted: <Check className="w-4 h-4 text-emerald-400" />,
                        declined: <X className="w-4 h-4 text-red-400" />,
                        maybe: <HelpCircle className="w-4 h-4 text-amber-400" />,
                      };
                      return (
                        <div key={invite.invite_id} className="flex items-center gap-3 py-1.5">
                          <div className="w-7 h-7 rounded-full glass-surface flex items-center justify-center text-xs font-medium text-slate-300">
                            {(invite.user_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-200 flex-1">{invite.user_name}</span>
                          {statusIcon[invite.status] || <div className="w-4 h-4 rounded-full bg-slate-600" />}
                          <span className="text-xs text-slate-500 capitalize">{invite.status}</span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleStartGame}
                    disabled={startingGame}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #EE6C29, #C45A22)" }}
                  >
                    <Play className="w-4 h-4" />
                    {startingGame ? "Starting..." : (t.game?.startGame || "Start Game")}
                  </button>
                </div>
              ) : (
                /* Invitee View */
                <div className="space-y-4">
                  <div className="space-y-2 text-sm text-slate-400">
                    {detailEvent.default_buy_in && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-orange-400" />
                        <span>${detailEvent.default_buy_in} buy-in</span>
                      </div>
                    )}
                    {detailStats && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-orange-400" />
                        <span>{detailStats.accepted} going &middot; {detailStats.maybe} maybe &middot; {detailStats.invited || 0} waiting</span>
                      </div>
                    )}
                  </div>

                  {detailEvent.my_rsvp && (
                    <p className="text-center text-sm text-slate-400">
                      Your response: <span className="font-semibold capitalize text-slate-200">{detailEvent.my_rsvp}</span>
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { status: "accepted", label: "I'm in", icon: <Check className="w-4 h-4 mr-1" />, bg: "linear-gradient(135deg, #22C55E, #16A34A)" },
                      { status: "declined", label: "No", icon: <X className="w-4 h-4 mr-1" />, bg: "linear-gradient(135deg, #EF4444, #DC2626)" },
                      { status: "maybe", label: "Maybe", icon: <HelpCircle className="w-4 h-4 mr-1" />, bg: "linear-gradient(135deg, #F59E0B, #D97706)" },
                    ].map((btn) => (
                      <button
                        key={btn.status}
                        onClick={() => handleRsvp(btn.status)}
                        disabled={!!rsvpSubmitting}
                        className="py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
                        style={{ background: btn.bg }}
                      >
                        {rsvpSubmitting === btn.status ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>{btn.icon}{btn.label}</>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
