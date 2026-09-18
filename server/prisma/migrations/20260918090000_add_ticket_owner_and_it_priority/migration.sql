-- Lab 3 Issue 29: IT Staff Ticket Queue.

-- BR-20: extend TicketStatus additively, non-breaking to existing 'NEW' rows.
ALTER TYPE "TicketStatus" ADD VALUE 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- BR-16/BR-17: Ticket Owner, nullable FK to an active IT Staff/Administrator user.
ALTER TABLE "Ticket" ADD COLUMN "ticketOwnerId" INTEGER;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketOwnerId_fkey"
    FOREIGN KEY ("ticketOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Ticket_ticketOwnerId_idx" ON "Ticket"("ticketOwnerId");

-- BR-18: IT Priority is initialized from Requested Priority at creation, then independently
-- mutable by IT Staff/Administrator. Backfill existing rows before making the column required.
ALTER TABLE "Ticket" ADD COLUMN "itPriority" "Priority";

UPDATE "Ticket" SET "itPriority" = "requestedPriority" WHERE "itPriority" IS NULL;

ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL;
