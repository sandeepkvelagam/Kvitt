import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Send,
  CreditCard,
  Loader2,
  Wallet,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import Navbar from "@/components/Navbar";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function RequestAndPay() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("owed"); // "owed" | "owes"
  const [payingUserId, setPayingUserId] = useState(null);
  const [requestingUserId, setRequestingUserId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/ledger/consolidated-detailed`);
      setData(res.data);
    } catch {
      toast.error("Failed to load balance data");
    } finally {
      setLoading(false);
    }
  };

  const handlePayNet = async (person) => {
    setPayingUserId(person.user?.user_id);
    try {
      const ledgerIds = person.all_ledger_ids ||
        person.game_breakdown?.flatMap((g) => g.ledger_ids || []) || [];
      const response = await axios.post(`${API}/ledger/pay-net/prepare`, {
        other_user_id: person.user?.user_id,
        ledger_ids: ledgerIds,
        origin_url: window.location.origin,
      });
      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      } else {
        toast.error("Could not create payment link");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create payment");
    } finally {
      setPayingUserId(null);
    }
  };

  const handleRequestPayment = async (person) => {
    const firstLedgerId =
      person.game_breakdown?.find((g) => g.direction === "owed_to_you")?.ledger_ids?.[0] ||
      person.all_ledger_ids?.[0];
    if (!firstLedgerId) return;

    setRequestingUserId(person.user?.user_id);
    try {
      await axios.post(`${API}/ledger/${firstLedgerId}/request-payment`);
      toast.success(`Payment request sent to ${person.user?.name}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send request");
    } finally {
      setRequestingUserId(null);
    }
  };

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const consolidated = data?.consolidated || [];
  const owedToYou = consolidated.filter((p) => p.direction === "owed_to_you");
  const youOwe = consolidated.filter((p) => p.direction === "you_owe");
  const activeList = tab === "owed" ? owedToYou : youOwe;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>

        <h1 className="font-heading text-2xl font-bold mb-6">Request & Pay</h1>

        {/* Balance Summary */}
        <Card className="bg-card border-border/50 mb-4">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">You Owe</p>
                <p className="text-lg font-bold text-destructive">
                  ${(data?.total_you_owe || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Owed to You</p>
                <p className="text-lg font-bold text-primary">
                  ${(data?.total_owed_to_you || 0).toFixed(2)}
                </p>
              </div>
              <div className="border-l border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Net</p>
                <p className={`text-lg font-bold ${(data?.net_balance || 0) >= 0 ? "text-primary" : "text-destructive"}`}>
                  {(data?.net_balance || 0) >= 0 ? "+" : ""}${(data?.net_balance || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab bar */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={tab === "owed" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("owed")}
          >
            Owed to You ({owedToYou.length})
          </Button>
          <Button
            variant={tab === "owes" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("owes")}
          >
            You Owe ({youOwe.length})
          </Button>
        </div>

        {/* Person list */}
        {activeList.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">All settled up!</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {activeList.map((person) => (
              <AccordionItem
                key={person.user?.user_id}
                value={person.user?.user_id}
                className="border border-border/50 rounded-xl overflow-hidden bg-card"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={person.user?.picture} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                        {getInitials(person.user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">{person.user?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {person.game_count || 1} game{(person.game_count || 1) > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className={`font-mono font-bold text-sm ${
                      person.direction === "owed_to_you" ? "text-primary" : "text-destructive"
                    }`}>
                      ${(person.display_amount || Math.abs(person.net_amount || 0)).toFixed(2)}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  {/* Offset explanation */}
                  {person.offset_explanation && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-3 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
                      <span className="text-amber-600 dark:text-amber-400">
                        Auto-netted: ${person.offset_explanation.offset_amount?.toFixed(2)} offset across games
                      </span>
                    </div>
                  )}

                  {/* Game breakdown */}
                  {person.game_breakdown?.map((game, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                    >
                      <div>
                        <p className="text-xs font-medium">{game.game_title || "Game"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {game.game_date ? new Date(game.game_date).toLocaleDateString() : ""}
                        </p>
                      </div>
                      <span className={`text-xs font-mono ${
                        game.direction === "owed_to_you" ? "text-primary" : "text-destructive"
                      }`}>
                        {game.direction === "owed_to_you" ? "+" : "-"}${Math.abs(game.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {/* Action button */}
                  <div className="mt-3">
                    {tab === "owed" ? (
                      <Button
                        size="sm"
                        className="w-full h-9 text-xs"
                        onClick={() => handleRequestPayment(person)}
                        disabled={requestingUserId === person.user?.user_id}
                      >
                        {requestingUserId === person.user?.user_id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3 mr-1" />
                        )}
                        Request ${(person.display_amount || Math.abs(person.net_amount || 0)).toFixed(2)}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full h-9 text-xs bg-[#635bff] hover:bg-[#5046e5]"
                        onClick={() => handlePayNet(person)}
                        disabled={payingUserId === person.user?.user_id}
                      >
                        {payingUserId === person.user?.user_id ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <CreditCard className="w-3 h-3 mr-1" />
                        )}
                        Pay Net ${(person.display_amount || Math.abs(person.net_amount || 0)).toFixed(2)}
                      </Button>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {/* Wallet link */}
        <Button
          variant="outline"
          className="w-full mt-4 text-sm"
          onClick={() => navigate("/wallet")}
        >
          <Wallet className="w-4 h-4 mr-2" />
          Send Money via Wallet
        </Button>
      </main>
    </div>
  );
}
