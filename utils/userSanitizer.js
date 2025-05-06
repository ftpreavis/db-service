function sanitizeUser(user) {
    if (!user) return null;
    const {id, username, stats, avatar } = user;
    return { id, username, stats, avatar };
}

module.exports = sanitizeUser;