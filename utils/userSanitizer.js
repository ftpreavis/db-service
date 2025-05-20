function sanitizeUser(user) {
    if (!user) return null;

    const { id, username, stats, avatar, MatchesAsPlayer1, MatchesAsPlayer2 } = user;

    return {
        id,
        username,
        stats,
        avatar,
        MatchesAsPlayer1: MatchesAsPlayer1 ?? [],
        MatchesAsPlayer2: MatchesAsPlayer2 ?? []
    };
}

module.exports = sanitizeUser;
