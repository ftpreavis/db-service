function sanitizeUser(user) {
    if (!user) return null;

    const {
        id,
        username,
        stats,
        avatar,
        biography,
        MatchesAsPlayer1,
        MatchesAsPlayer2,
        sentRequests,
        receivedRequests
    } = user;

    return {
        id,
        username,
        stats,
        avatar,
        biography,
        MatchesAsPlayer1: MatchesAsPlayer1 ?? [],
        MatchesAsPlayer2: MatchesAsPlayer2 ?? [],
        sentRequests: (sentRequests ?? []).map(f => ({
            status: f.status,
            userId: f.userId,
            friendId: f.friendId
        })),
        receivedRequests: (receivedRequests ?? []).map(f => ({
            status: f.status,
            userId: f.userId,
            friendId: f.friendId
        }))
    };
}

module.exports = sanitizeUser;
