import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";

export default function StickyHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 80);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      {/* Desktop header */}
      <header
        className={cn(
          "hidden md:block fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-background/95 backdrop-blur-lg border-b border-border shadow-sm"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Logo showTagline={false} dark={!scrolled} />
            <div className="flex items-center gap-6">
              <a
                href="#how-it-works"
                className={cn(
                  "text-sm font-medium transition-colors cursor-pointer",
                  scrolled
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-white/70 hover:text-white"
                )}
              >
                How it Works
              </a>
              <a
                href="#features"
                className={cn(
                  "text-sm font-medium transition-colors cursor-pointer",
                  scrolled
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-white/70 hover:text-white"
                )}
              >
                Features
              </a>
              <a
                href="#faq"
                className={cn(
                  "text-sm font-medium transition-colors cursor-pointer",
                  scrolled
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-white/70 hover:text-white"
                )}
              >
                FAQ
              </a>
              <Link to="/login">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6 text-sm cursor-pointer">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-transparent">
        <div className="max-w-7xl mx-auto px-4">
          <div
            className={cn(
              "flex items-center transition-all duration-500",
              scrolled ? "h-14 justify-center" : "h-14 justify-between"
            )}
          >
            {!scrolled && (
              <>
                <Logo showTagline={false} size="small" />
                <Link to="/login">
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-4 text-xs cursor-pointer"
                  >
                    Get Started
                  </Button>
                </Link>
              </>
            )}

            {scrolled && (
              <Link
                to="/login"
                className="bg-foreground text-background rounded-full px-5 py-2.5 shadow-lg flex items-center gap-2 border border-border/20 cursor-pointer"
              >
                <Logo showText={false} size="small" />
                <span className="text-sm font-bold">Kvitt</span>
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
