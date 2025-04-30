function sanitizeUser(user) {
    if (!user) return null;
    const {id, username, stats } = user;
    return { id, username, stats };
}

module.exports = sanitizeUser;