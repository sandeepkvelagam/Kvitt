import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ArrowLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  DollarSign,
  Repeat,
  Check,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

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

export default function CreateEventPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [groups, setGroups] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedDate, setSelectedDate] = useState(undefined);
  const [selectedTime, setSelectedTime] = useState("19:00");
  const [recurrence, setRecurrence] = useState("none");
  const [gameCategory, setGameCategory] = useState("poker");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [buyIn, setBuyIn] = useState("");
  const [duration, setDuration] = useState("180");

  useEffect(() => {
    axios
      .get(`${API}/groups`)
      .then((res) => setGroups(res.data || []))
      .catch(() => {});
  }, []);

  const selectedGroup = groups.find((g) => g.group_id === selectedGroupId);

  const canProceed = () => {
    switch (step) {
      case 1: return !!selectedGroupId;
      case 2: return !!selectedDate && !!selectedTime;
      case 3: return !!title;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate) return;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const startsAt = new Date(selectedDate);
    startsAt.setHours(hours, minutes, 0, 0);

    try {
      setSubmitting(true);
      await axios.post(`${API}/events`, {
        group_id: selectedGroupId,
        title,
        starts_at: startsAt.toISOString(),
        duration_minutes: parseInt(duration) || 180,
        location: location || null,
        game_category: gameCategory,
        recurrence,
        default_buy_in: buyIn ? parseFloat(buyIn) : null,
        invite_scope: "group",
      });
      toast.success(t.scheduler?.eventCreated || "Game scheduled! Invites sent.");
      navigate("/schedule");
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to create event";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const formatSelectedDate = () => {
    if (!selectedDate) return "";
    return selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t.common?.back || "Back"}
        </button>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Group Selection */}
        {step === 1 && (
          <div>
            <h1 className="font-heading text-2xl font-bold mb-2">
              {t.scheduler?.whichGroup || "Which group?"}
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              {t.scheduler?.selectGroup || "Choose a group to schedule a game for"}
            </p>
            <div className="space-y-2">
              {groups.length === 0 ? (
                <Card className="bg-card border-border/50">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    {t.groups?.noGroups || "No groups yet"}
                  </CardContent>
                </Card>
              ) : (
                groups.map((group) => (
                  <button
                    key={group.group_id}
                    onClick={() => setSelectedGroupId(group.group_id)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      selectedGroupId === group.group_id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.member_count} {t.groups?.members || "members"}
                        </p>
                      </div>
                      {selectedGroupId === group.group_id && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div>
            <h1 className="font-heading text-2xl font-bold mb-2">
              {t.scheduler?.when || "When?"}
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              {t.scheduler?.pickDateTime || "Pick a date and time"}
            </p>

            <Card className="bg-card border-border/50 mb-4">
              <CardContent className="p-4 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={{ before: new Date() }}
                />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {t.scheduler?.time || "Time"}
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
                  {t.scheduler?.repeat || "Repeat"}
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
          </div>
        )}

        {/* Step 3: Game Details */}
        {step === 3 && (
          <div>
            <h1 className="font-heading text-2xl font-bold mb-2">
              {t.scheduler?.details || "Details"}
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              {t.scheduler?.fillDetails || "Set up your game"}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t.scheduler?.gameType || "Game type"}
                </label>
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
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t.scheduler?.title || "Title"}
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Friday Night Poker"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  {t.scheduler?.location || "Location (optional)"}
                </label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Jake's place"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    <DollarSign className="w-3 h-3 inline mr-1" />
                    {t.scheduler?.buyIn || "Buy-in ($)"}
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
                    {t.scheduler?.duration || "Duration (min)"}
                  </label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="180"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div>
            <h1 className="font-heading text-2xl font-bold mb-2">
              {t.scheduler?.review || "Review"}
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              {t.scheduler?.confirmDetails || "Confirm and send invites"}
            </p>

            <Card className="bg-card border-border/50 mb-6">
              <CardContent className="p-5 space-y-3">
                <p className="font-heading text-lg font-bold">{title}</p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    <span>
                      {formatSelectedDate()} ·{" "}
                      {TIME_OPTIONS.find((o) => o.value === selectedTime)?.label}
                    </span>
                  </div>
                  {recurrence !== "none" && (
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-primary" />
                      <span>
                        {RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label}
                      </span>
                    </div>
                  )}
                  {location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{location}</span>
                    </div>
                  )}
                  {buyIn && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span>${buyIn} buy-in</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span>
                      {selectedGroup?.name} ({selectedGroup?.member_count}{" "}
                      {t.groups?.members || "members"})
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-8">
          {step < 4 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 bg-primary text-black hover:bg-primary/90"
            >
              {t.common?.next || "Next"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-primary text-black hover:bg-primary/90"
            >
              {submitting
                ? t.common?.loading || "Scheduling..."
                : t.scheduler?.scheduleAndInvite || "Schedule & Invite"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
