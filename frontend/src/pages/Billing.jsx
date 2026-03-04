import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Clock, Receipt } from "lucide-react";

export default function Billing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Billing</h1>
            <p className="text-sm text-muted-foreground">Subscription & payment methods</p>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg">Coming Soon</h2>
              <p className="text-sm text-muted-foreground">
                Premium subscriptions and billing management are currently in development.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder Sections */}
        <div className="space-y-4 opacity-50 pointer-events-none">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Current Plan</p>
                <p className="text-sm text-muted-foreground">Free tier — no active subscription</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Receipt className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Payment Methods</p>
                <p className="text-sm text-muted-foreground">No payment methods on file</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Billing History</p>
                <p className="text-sm text-muted-foreground">No transactions to display</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
