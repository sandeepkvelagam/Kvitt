import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  DollarSign,
  Users,
  Check,
  X,
  HelpCircle,
  Clock,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function RSVPPage() {
  const navigate = useNavigate();
  const { occurrenceId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [detail, setDetail] = useState(null);
  const [currentRsvp, setCurrentRsvp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!occurrenceId) return;
      try {
        const invRes = await axios.get(`${API}/occurrences/${occurrenceId}/invites`);
        const invData = invRes.data;

        const myInvite = (invData.invites || []).find(
          (i) => i.user_id === user?.user_id
        );

        let eventData = {};
        if (invData.event_id) {
          try {
            const evtRes = await axios.get(`${API}/events/${invData.event_id}`);
            eventData = evtRes.data;
          } catch {}
        }

        const occ = (eventData.occurrences || []).find(
          (o) => o.occurrence_id === occurrenceId
        );

        setDetail({
          occurrence_id: occurrenceId,
          event_id: invData.event_id || "",
          title: eventData.title || "Game Night",
          starts_at: occ?.starts_at || "",
          duration_minutes: occ?.duration_minutes || 180,
          location: eventData.location || occ?.location || null,
          game_category: eventData.game_category || "poker",
          default_buy_in: eventData.default_buy_in,
          my_rsvp: myInvite?.status || null,
          stats: invData.stats,
        });
        setCurrentRsvp(myInvite?.status || null);
      } catch (err) {
        console.error("Failed to fetch occurrence detail:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [occurrenceId, user?.user_id]);

  const handleRsvp = async (status) => {
    try {
      setSubmitting(status);
      const res = await axios.post(`${API}/occurrences/${occurrenceId}/rsvp`, {
        status,
      });
      setCurrentRsvp(status);

      if (res.data.stats) {
        setDetail((prev) =>
          prev ? { ...prev, stats: res.data.stats, my_rsvp: status } : prev
        );
      }

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
      setSubmitting(null);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t.common?.back || "Back"}
        </button>

        <h1 className="font-heading text-2xl font-bold mb-6">
          {t.scheduler?.youreInvited || "You're invited!"}
        </h1>

        {/* Event details card */}
        <Card className="bg-card border-border/50 mb-6">
          <CardContent className="p-5 space-y-3">
            <p className="font-heading text-xl font-bold">{detail?.title}</p>

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>
                  {formatDate(detail?.starts_at)} at {formatTime(detail?.starts_at)}
                </span>
              </div>

              {detail?.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>{detail.location}</span>
                </div>
              )}

              {detail?.default_buy_in && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <span>${detail.default_buy_in} buy-in</span>
                </div>
              )}

              {detail?.stats && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>
                    {detail.stats.accepted} {t.scheduler?.going || "going"} ·{" "}
                    {detail.stats.maybe} {t.scheduler?.maybe || "maybe"} ·{" "}
                    {detail.stats.invited} {t.scheduler?.waiting || "waiting"}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current RSVP status */}
        {currentRsvp && (
          <p className="text-center text-sm text-muted-foreground mb-4">
            {t.scheduler?.yourResponse || "Your current response"}:{" "}
            <span className="font-semibold capitalize">{currentRsvp}</span>
          </p>
        )}

        {/* RSVP buttons: 2x2 grid */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => handleRsvp("accepted")}
            disabled={!!submitting}
            className="h-14 bg-green-600 hover:bg-green-700 text-white"
          >
            {submitting === "accepted" ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {t.scheduler?.imIn || "I'm in"}
              </>
            )}
          </Button>

          <Button
            onClick={() => handleRsvp("declined")}
            disabled={!!submitting}
            className="h-14 bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting === "declined" ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <X className="w-4 h-4 mr-2" />
                {t.scheduler?.cantMakeIt || "Can't make it"}
              </>
            )}
          </Button>

          <Button
            onClick={() => handleRsvp("maybe")}
            disabled={!!submitting}
            variant="outline"
            className="h-14 border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10"
          >
            {submitting === "maybe" ? (
              <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <HelpCircle className="w-4 h-4 mr-2" />
                {t.scheduler?.maybe || "Maybe"}
              </>
            )}
          </Button>

          <Button
            onClick={() =>
              toast.info(
                t.scheduler?.suggestTimeComingSoon ||
                  "Proposing a new time will be available in a future update."
              )
            }
            disabled={!!submitting}
            variant="outline"
            className="h-14"
          >
            <Clock className="w-4 h-4 mr-2" />
            {t.scheduler?.suggestTime || "Suggest time"}
          </Button>
        </div>
      </main>
    </div>
  );
}
