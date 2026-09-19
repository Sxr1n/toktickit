-- Flagged in PR #38 review: the Staff Ticket Queue filters and sorts by currentStatus, but no
-- index existed to support it.

CREATE INDEX "Ticket_currentStatus_idx" ON "Ticket"("currentStatus");
