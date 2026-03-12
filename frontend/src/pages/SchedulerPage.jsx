import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
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
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  DollarSign,
  Repeat,
  Check,
  X,
  HelpCircle,
  Play,
  ChevronRight,
  Search,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// ── Quick Schedule Tile Presets ──────────────────────────────────
const QUICK_TILES = [
  { id: "fri-poker",   title: "Friday Night Poker",  day: 5, time: "19:00", game: "poker",   buyIn: 20, tag: "Popular",    tone: "amber",  icon: "\u2660" },
  { id: "sat-rummy",   title: "Saturday Rummy",      day: 6, time: "20:00", game: "rummy",   buyIn: 15, tag: "Classic",    tone: "mint",   icon: "\u2666" },
  { id: "sun-spades",  title: "Sunday Spades",       day: 0, time: "18:00", game: "spades",  buyIn: 10, tag: "Chill",      tone: "purple", icon: "\u2663" },
  { id: "custom",      title: "Custom Game Night",   day: null, time: null, game: "other",   buyIn: null, tag: "Your rules", tone: "rose", icon: "\u2665" },
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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS = {
  accepted: "bg-green-500",
  declined: "bg-red-500",
  maybe: "bg-yellow-500",
  invited: "bg-gray-400",
};

// ── Helper: get next occurrence of a given weekday ───────────────
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

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Fetch group members when group changes
  useEffect(() => {
    if (!selectedGroupId) {
      setMembers([]);
      return;
    }
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

      // Update local event list
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

  // ── Format helpers ─────────────────────────────────────────────
  const formatDate = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const selectedGroup = groups.find((g) => g.group_id === selectedGroupId);
  const isHost = (event) => event.host_id === user?.user_id;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t.common?.back || "Back"}
        </button>

        {/* Header with group selector */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
            {t.scheduler?.schedule || "Schedule"}
          </h1>
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-[180px]">
              <Users className="w-4 h-4 mr-2 text-muted-foreground" />
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

        {/* ── Upcoming Games ──────────────────────────────────── */}
        {events.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t.scheduler?.upcoming || "Upcoming Games"}
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {events.map((event) => (
                <Card
                  key={event.occurrence_id || event.event_id}
                  className="min-w-[160px] max-w-[180px] bg-card border-border/50 cursor-pointer hover:border-primary/30 transition-all shrink-0"
                  onClick={() => openDetailSheet(event)}
                >
                  <CardContent className="p-3">
                    <p className="font-heading text-xs font-bold text-primary mb-1">
                      {formatDate(event.starts_at)}
                    </p>
                    <p className="font-medium text-sm truncate mb-1">{event.title}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {formatTime(event.starts_at)}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[event.my_rsvp] || STATUS_COLORS.invited}`} />
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {event.my_rsvp || "invited"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Schedule Tiles ────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t.scheduler?.quickSchedule || "Quick Schedule"}
          </h2>

          {!selectedGroupId ? (
            <Card className="bg-card border-border/50">
              <CardContent className="p-6 text-center">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Select a group above to schedule a game
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {QUICK_TILES.map((tile) => (
                <GlassTile
                  key={tile.id}
                  size="lg"
                  tone={tile.tone}
                  elevated
                  onClick={() => openCreateSheet(tile)}
                  className="flex flex-col justify-between min-h-[180px]"
                >
                  {/* Icon */}
                  <div className="text-3xl mb-2 opacity-60">{tile.icon}</div>

                  {/* Title + Buy-in */}
                  <div className="mb-2">
                    <h3 className="font-heading text-sm font-bold leading-tight">
                      {tile.title}
                    </h3>
                    {tile.buyIn != null && (
                      <span className="glass-chip text-[10px] mt-1 inline-block">
                        ${tile.buyIn}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="glass-chip text-[10px]">{tile.tag}</span>
                    {tile.time && (
                      <span className="glass-chip text-[10px]">
                        {TIME_OPTIONS.find((o) => o.value === tile.time)?.label || tile.time}
                      </span>
                    )}
                  </div>

                  {/* CTA */}
                  <Button
                    size="sm"
                    className="w-full bg-primary text-black hover:bg-primary/90 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      openCreateSheet(tile);
                    }}
                  >
                    {tile.id === "custom"
                      ? (t.scheduler?.customize || "Customize")
                      : (t.scheduler?.scheduleNow || "Schedule Now")}
                  </Button>
                </GlassTile>
              ))}
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && events.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && selectedGroupId && (
          <Card className="bg-card border-border/50">
            <CardContent className="p-6 text-center">
              <CalendarIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {t.scheduler?.noEvents || "No upcoming games. Tap a tile above to schedule one!"}
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* ── Create Event Bottom Sheet ────────────────────────── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-heading text-xl">
              {activeTile?.title || "Schedule Game"}
            </SheetTitle>
            <SheetDescription>
              {selectedGroup
                ? `Sending to ${selectedGroup.name} (${selectedGroup.member_count || members.length} members)`
                : "Configure and send invites"}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            {/* Day toggle chips (for preset tiles) */}
            {activeTile?.id !== "custom" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Day</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: "Fri", day: 5 },
                    { label: "Sat", day: 6 },
                    { label: "Sun", day: 0 },
                  ].map((d) => (
                    <button
                      key={d.day}
                      onClick={() => setSelectedDate(getNextDayOfWeek(d.day))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedDate && selectedDate.getDay() === d.day
                          ? "bg-primary text-black"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {selectedDate && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Calendar picker for custom */}
            {activeTile?.id === "custom" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate
                        ? selectedDate.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={{ before: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Time + Recurrence */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Time
                </label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  <Repeat className="w-3 h-3 inline mr-1" />
                  Repeat
                </label>
                <Select value={recurrence} onValueChange={setRecurrence}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Game type + Title (for custom) */}
            {activeTile?.id === "custom" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Game type</label>
                  <Select value={gameCategory} onValueChange={setGameCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GAME_TYPES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Friday Night Poker"
                  />
                </div>
              </>
            )}

            {/* Buy-in + Duration + Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  <DollarSign className="w-3 h-3 inline mr-1" />
                  Buy-in ($)
                </label>
                <Input
                  type="number"
                  value={buyIn}
                  onChange={(e) => setBuyIn(e.target.value)}
                  placeholder="20"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Duration (min)
                </label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="180"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                <MapPin className="w-3 h-3 inline mr-1" />
                Location (optional)
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Jake's place"
              />
            </div>

            {/* Member preview */}
            {members.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  Sending invites to
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  {members.slice(0, 8).map((m) => (
                    <Popover key={m.user_id}>
                      <PopoverTrigger asChild>
                        <button className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium hover:ring-2 hover:ring-primary/50 transition-all">
                          {(m.name || m.user_name || "?").charAt(0).toUpperCase()}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="top" className="px-3 py-1.5 text-xs w-auto">
                        {m.name || m.user_name || "Member"}
                      </PopoverContent>
                    </Popover>
                  ))}
                  {members.length > 8 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      +{members.length - 8} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedDate || !selectedGroupId}
              className="w-full bg-primary text-black hover:bg-primary/90 h-12 text-sm font-semibold"
            >
              {submitting
                ? (t.common?.loading || "Scheduling...")
                : (t.scheduler?.scheduleAndInvite || "Schedule & Send Invites")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Event Detail Bottom Sheet (RSVP / Host) ──────────── */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          {detailEvent && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="font-heading text-xl">
                  {detailEvent.title}
                </SheetTitle>
                <SheetDescription>
                  {formatDate(detailEvent.starts_at)} at {formatTime(detailEvent.starts_at)}
                  {detailEvent.location && ` \u00b7 ${detailEvent.location}`}
                </SheetDescription>
              </SheetHeader>

              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : isHost(detailEvent) ? (
                /* ── Host View ──────────────────────────────── */
                <div className="space-y-4">
                  {/* RSVP Stats */}
                  {detailStats && (
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Going", count: detailStats.accepted, color: "bg-green-500" },
                        { label: "Maybe", count: detailStats.maybe, color: "bg-yellow-500" },
                        { label: "No", count: detailStats.declined, color: "bg-red-500" },
                        { label: "Waiting", count: (detailStats.invited || 0) + (detailStats.no_response || 0), color: "bg-gray-400" },
                      ].map((s) => (
                        <div key={s.label} className="text-center">
                          <div className={`w-2.5 h-2.5 rounded-full ${s.color} mx-auto mb-1`} />
                          <p className="font-heading text-lg font-bold">{s.count}</p>
                          <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Member responses */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Responses
                    </h3>
                    {detailInvites.map((invite) => {
                      const statusIcon = {
                        accepted: <Check className="w-4 h-4 text-green-500" />,
                        declined: <X className="w-4 h-4 text-red-500" />,
                        maybe: <HelpCircle className="w-4 h-4 text-yellow-500" />,
                      };
                      return (
                        <div key={invite.invite_id} className="flex items-center gap-3 py-1.5">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                            {(invite.user_name || "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm flex-1">{invite.user_name}</span>
                          {statusIcon[invite.status] || (
                            <div className="w-4 h-4 rounded-full bg-gray-300" />
                          )}
                          <span className="text-xs text-muted-foreground capitalize">
                            {invite.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Start Game button */}
                  <Button
                    onClick={handleStartGame}
                    disabled={startingGame}
                    className="w-full bg-primary text-black hover:bg-primary/90 h-12"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {startingGame
                      ? (t.common?.loading || "Starting...")
                      : (t.game?.startGame || "Start Game")}
                  </Button>
                </div>
              ) : (
                /* ── Invitee View ──────────────────────────── */
                <div className="space-y-4">
                  {/* Event info */}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {detailEvent.default_buy_in && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span>${detailEvent.default_buy_in} buy-in</span>
                      </div>
                    )}
                    {detailStats && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        <span>
                          {detailStats.accepted} going · {detailStats.maybe} maybe · {detailStats.invited || 0} waiting
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Current status */}
                  {detailEvent.my_rsvp && (
                    <p className="text-center text-sm text-muted-foreground">
                      Your response: <span className="font-semibold capitalize">{detailEvent.my_rsvp}</span>
                    </p>
                  )}

                  {/* RSVP buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={() => handleRsvp("accepted")}
                      disabled={!!rsvpSubmitting}
                      className="h-12 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {rsvpSubmitting === "accepted" ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          I'm in
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleRsvp("declined")}
                      disabled={!!rsvpSubmitting}
                      className="h-12 bg-red-600 hover:bg-red-700 text-white"
                    >
                      {rsvpSubmitting === "declined" ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <X className="w-4 h-4 mr-1" />
                          No
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleRsvp("maybe")}
                      disabled={!!rsvpSubmitting}
                      variant="outline"
                      className="h-12 border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
                    >
                      {rsvpSubmitting === "maybe" ? (
                        <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <HelpCircle className="w-4 h-4 mr-1" />
                          Maybe
                        </>
                      )}
                    </Button>
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
