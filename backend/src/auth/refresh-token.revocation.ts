/**
 * Marks every live refresh session for a user as revoked.
 * Already-revoked rows are left unchanged.
 */
export async function revokeAllRefreshTokensForUser(
  prisma: {
    refreshToken: {
      updateMany: (args: {
        where: { userId: number; isRevoked: false };
        data: { isRevoked: true; revokedAt: Date };
      }) => Promise<{ count: number }>;
    };
  },
  userId: number,
): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true, revokedAt: new Date() },
  });
}
