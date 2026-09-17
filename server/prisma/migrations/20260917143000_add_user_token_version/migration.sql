-- A stateless JWT has no server-side record to delete on logout, so without something to check
-- against, a client that ignores the cleared cookie (or a copy of an old token) keeps working
-- forever. tokenVersion is embedded in every issued token; logout increments it, which
-- invalidates every token issued before that moment in one cheap comparison -- no separate
-- session-store table needed (BR-10, BR-11).

ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
