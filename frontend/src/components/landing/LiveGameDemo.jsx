import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, ArrowRight, Shield, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const playerData = [
  { name: "You (Host)", avatar: "Y", buyIn: 20, finalChips: 35 },
  { name: "Mike T.", avatar: "M", buyIn: 20, finalChips: 12 },
  { name: "Sarah K.", avatar: "S", buyIn: 20, finalChips: 28 },
  { name: "James R.", avatar: "J", buyIn: 20, finalChips: 5 },
];

const avatarColors = [
  "bg-primary/20 text-primary",
  "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
];

const formatTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export default function LiveGameDemo() {
  const [phase, setPhase] = useState(0);
  const [players, setPlayers] = useState([]);
  const [timer, setTimer] = useState(0);
  const [chipBank, setChipBank] = useState(0);
  const [showRequest, setShowRequest] = useState(false);
  const [requestHandled, setRequestHandled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);
  const timeoutsRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    const clearAll = () => {
      timeoutsRef.current.forEach(clearTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };

    const runDemo = () => {
      clearAll();
      timeoutsRef.current = [];
      setPhase(0);
      setPlayers([]);
      setTimer(0);
      setChipBank(0);
      setShowRequest(false);
      setRequestHandled(false);

      // Players join
      playerData.forEach((p, i) => {
        const t = setTimeout(() => {
          setPlayers((prev) => [
            ...prev,
            { ...p, chips: p.buyIn, status: "playing" },
          ]);
          setChipBank((prev) => prev + p.buyIn);
        }, 800 * (i + 1));
        timeoutsRef.current.push(t);
      });

      // Game running — timer starts
      const startTimer = setTimeout(() => {
        setPhase(1);
        timerRef.current = setInterval(
          () => setTimer((prev) => prev + 1),
          1000
        );
      }, 3500);
      timeoutsRef.current.push(startTimer);

      // Buy-in request
      const requestTime = setTimeout(() => setShowRequest(true), 5500);
      timeoutsRef.current.push(requestTime);

      // Auto-approve
      const approveTime = setTimeout(() => {
        setRequestHandled(true);
        setShowRequest(false);
        setChipBank((prev) => prev + 20);
        setPlayers((prev) =>
          prev.map((p) =>
            p.name === "Mike T." ? { ...p, chips: p.chips + 20 } : p
          )
        );
      }, 7500);
      timeoutsRef.current.push(approveTime);

      // Cash out
      const cashOut = setTimeout(() => {
        setPhase(2);
        if (timerRef.current) clearInterval(timerRef.current);
        setPlayers((prev) =>
          prev.map((p) => ({
            ...p,
            chips: p.finalChips,
            profit: p.finalChips - p.buyIn,
            status: "cashed_out",
          }))
        );
      }, 10000);
      timeoutsRef.current.push(cashOut);

      // Reset
      const reset = setTimeout(runDemo, 16000);
      timeoutsRef.current.push(reset);
    };

    runDemo();
    return clearAll;
  }, [isVisible]);

  return (
    <section
      ref={sectionRef}
      className="demo-section py-20 sm:py-28 bg-muted/50"
      id="features"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Demo card */}
          <div className="scroll-animate-scale transition-all duration-700 ease-out">
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-lg">
              {/* Game header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 live-dot" />
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatTime(timer)}
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                  LIVE
                </span>
              </div>

              {/* Chip bank */}
              <div className="px-4 py-3 text-center bg-muted/50">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Chip Bank
                </span>
                <p className="text-xl font-black text-primary">${chipBank}</p>
              </div>

              {/* Player list */}
              <div className="p-4 space-y-2 h-[200px] overflow-hidden">
                {players.map((player, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50 animate-fade-in-up"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold",
                          avatarColors[i]
                        )}
                      >
                        {player.avatar}
                      </div>
                      <div>
                        <span className="text-xs font-medium text-foreground">
                          {player.name}
                        </span>
                        {player.status === "cashed_out" && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            (out)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-foreground">
                        ${player.chips}
                      </span>
                      {player.profit !== undefined && (
                        <span
                          className={cn(
                            "text-[10px] font-mono ml-1",
                            player.profit >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-500 dark:text-red-400"
                          )}
                        >
                          {player.profit >= 0 ? "+" : ""}
                          {player.profit}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Buy-in request popup */}
              <div className="h-[56px]">
                {showRequest && !requestHandled && (
                  <div className="mx-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          Buy-in Request
                        </p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                          Mike T. requests $20 re-buy
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center cursor-pointer">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center cursor-pointer">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Text */}
          <div>
            <div className="scroll-animate-right">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Play className="w-4 h-4" />
                Live Game Mode
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-foreground">
                Real-time game tracking
              </h2>
              <p className="text-muted-foreground mb-4 leading-relaxed">
                Host starts the game, players join with one tap. Buy-in requests
                with approval, live chip tracking, and automatic calculations.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                <li className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                  Host controls: approve or reject buy-in requests
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                  Immutable ledger — no disputes, no edits
                </li>
              </ul>
              <Link to="/login">
                <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 cursor-pointer">
                  Start a Live Game
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
