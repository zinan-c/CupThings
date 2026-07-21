import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { accounts, cupThings, loginChallenges, profiles, sessions } from "../db/schema.js";
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  createAccessToken,
  createRefreshToken,
  hashToken
} from "../auth.js";
import { HttpError } from "../http.js";

export const LOGIN_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export async function createLoginChallenge(email: string, displayName: string | undefined, profileId: string | undefined) {
  const token = createAccessToken();
  await db.delete(loginChallenges).where(and(
    eq(loginChallenges.email, email),
    isNull(loginChallenges.usedAt)
  ));
  await db.insert(loginChallenges).values({
    email,
    displayName,
    tokenHash: hashToken(token),
    profileId,
    expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_TTL_MS)
  });
  return token;
}

export async function verifyLoginChallenge(token: string) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [challenge] = await tx
      .update(loginChallenges)
      .set({ usedAt: now })
      .where(and(
        eq(loginChallenges.tokenHash, hashToken(token)),
        isNull(loginChallenges.usedAt),
        gt(loginChallenges.expiresAt, now)
      ))
      .returning();

    if (!challenge) throw new HttpError(401, "Invalid or expired login link");

    const [accountBefore] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.email, challenge.email))
      .limit(1);
    const account = accountBefore ?? (await tx
      .insert(accounts)
      .values({ email: challenge.email })
      .onConflictDoNothing({ target: accounts.email })
      .returning())[0] ?? (await tx
        .select()
        .from(accounts)
        .where(eq(accounts.email, challenge.email))
        .limit(1))[0];
    if (!account) throw new Error("Account was not created");

    const [sourceProfile] = challenge.profileId
      ? await tx.select().from(profiles).where(eq(profiles.id, challenge.profileId)).limit(1)
      : [];
    const [accountProfile] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, account.id))
      .limit(1);

    let profile = accountProfile;
    if (sourceProfile && accountProfile && sourceProfile.id !== accountProfile.id) {
      await tx.update(cupThings)
        .set({ profileId: accountProfile.id })
        .where(eq(cupThings.profileId, sourceProfile.id));
      await tx.delete(profiles).where(eq(profiles.id, sourceProfile.id));
    } else if (sourceProfile) {
      const [updatedProfile] = await tx
        .update(profiles)
        .set({ accountId: account.id, updatedAt: now })
        .where(eq(profiles.id, sourceProfile.id))
        .returning();
      profile = updatedProfile;
    }

    if (!profile) {
      const fallbackName = challenge.displayName ?? challenge.email.split("@")[0] ?? "CupThings user";
      const [createdProfile] = await tx
        .insert(profiles)
        .values({ accountId: account.id, displayName: fallbackName.slice(0, 80) })
        .returning();
      profile = createdProfile;
    }
    if (!profile) throw new Error("Profile was not created");

    await tx.execute(sql`select id from profiles where id = ${profile.id} for update`);
    await tx.update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.profileId, profile.id), isNull(sessions.revokedAt)));

    const accessToken = createAccessToken();
    const refreshToken = createRefreshToken();
    await tx.insert(sessions).values({
      profileId: profile.id,
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(refreshToken),
      accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
      refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS)
    });

    return { profile, accessToken, refreshToken };
  });
}

export async function rotateRefreshToken(refreshToken: string) {
  const now = new Date();
  const [result] = await db
    .select({ profile: profiles, session: sessions })
    .from(sessions)
    .innerJoin(profiles, eq(sessions.profileId, profiles.id))
    .where(and(
      eq(sessions.refreshTokenHash, hashToken(refreshToken)),
      gt(sessions.refreshExpiresAt, now),
      isNull(sessions.revokedAt)
    ))
    .limit(1);
  if (!result) throw new HttpError(401, "Invalid or expired refresh token");

  const accessToken = createAccessToken();
  const nextRefreshToken = createRefreshToken();
  const [rotated] = await db.update(sessions)
    .set({
      accessTokenHash: hashToken(accessToken),
      refreshTokenHash: hashToken(nextRefreshToken),
      accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
      refreshExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      lastUsedAt: now
    })
    .where(and(
      eq(sessions.id, result.session.id),
      eq(sessions.refreshTokenHash, hashToken(refreshToken)),
      isNull(sessions.revokedAt),
      gt(sessions.refreshExpiresAt, now)
    ))
    .returning({ id: sessions.id });
  if (!rotated) throw new HttpError(401, "Invalid or expired refresh token");
  return { profile: result.profile, accessToken, refreshToken: nextRefreshToken };
}

export async function revokeSession(sessionId: string) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function deleteAccount(profileId: string, accountId: string | null) {
  await db.transaction(async (tx) => {
    await tx.delete(profiles).where(eq(profiles.id, profileId));
    if (accountId) await tx.delete(accounts).where(eq(accounts.id, accountId));
  });
}
