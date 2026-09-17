-- Lab 3: replace the Development Requester fake-identity mechanism with real authentication.
--
-- Renames RequesterUser -> User in place rather than creating a new table and copying rows, so
-- existing Ticket.requesterId data and its foreign key are preserved automatically (same table,
-- same rows, same constraint -- provably lossless).

CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

ALTER TABLE "RequesterUser" RENAME TO "User";

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'REQUESTER';
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "User_role_idx" ON "User"("role");
