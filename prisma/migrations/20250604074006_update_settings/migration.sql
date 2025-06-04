-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "background" TEXT,
    "paddle" TEXT,
    "ball" TEXT,
    "divider" TEXT,
    "score" TEXT,
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "lang" TEXT NOT NULL DEFAULT 'english',
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("background", "ball", "divider", "id", "paddle", "score", "userId") SELECT "background", "ball", "divider", "id", "paddle", "score", "userId" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
