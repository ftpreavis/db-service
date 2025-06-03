const { PrismaClient } = require('@prisma/client');
const sanitizeUser = require("../utils/userSanitizer");
const prisma = new PrismaClient();

module.exports = async function (fastify, opts) {

	async function generateUniqueUsername(base) {
		let username = base;
		let suffix = 0;

		while (true) {
			const existing = await prisma.user.findUnique({
				where: { username },
			});

			if (!existing) break;

			suffix++;
			username = `${base}${suffix}`;
		}

		return username;
	}

	fastify.get('/users', async (request, reply) => {
		try{
			return await prisma.user.findMany({
				where: {
					deletedAt: null,
				},
				select: {
					id: true,
					username: true,
					stats: true,
				}
			});
		} catch(err) {
			console.error('Error getting users', err);
			return reply.code(500).send({ error: 'Internal Server Error' });
		}
	});

	fastify.get('/users/:idOrUsername', async (request, reply) => {
		const { idOrUsername } = request.params;

		let user;

		const include = {
			stats: true,
			sentRequests: {
				select: {
					id: true,
					status: true,
					userId: true,
					friendId: true
				}
			},
			receivedRequests: {
				select: {
					id: true,
					status: true,
					userId: true,
					friendId: true
				}
			},
			MatchesAsPlayer1: {
				where: { status: 'DONE' },
				include: {
					player2: { select: { username: true } }
				},
				orderBy: { playedAt: 'desc' }
			},
			MatchesAsPlayer2: {
				where: { status: 'DONE' },
				include: {
					player1: { select: { username: true } }
				},
				orderBy: { playedAt: 'desc' }
			},
		};

		if (/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(idOrUsername)) {
			// Search by email
			user = await prisma.user.findUnique({
				where: {email: idOrUsername},
				include
			});
		} else if (/^\d+$/.test(idOrUsername)) {
			// Search by id or username
			user = await prisma.user.findUnique({
				where: { id: Number(idOrUsername) },
				include
			});
		} else {
			user = await prisma.user.findUnique({
				where: { username: idOrUsername },
				include
			});
		}
		if (user?.deletedAt !== null) {
			return reply.code(404).send({ error: 'User not found or deleted.' });
		}
		const safeUser = sanitizeUser(user);
		if (!safeUser) {
			return reply.code(500).send({ error: 'Sanitization failed' });
		}

		return reply.send(safeUser);
	});

	fastify.post('/users', async (req, reply) => {
		const { username, password, email } = req.body;

		try {
			const user = await prisma.user.create({
				data: {
					username: username,
					password: password,
					email: email,
					authMethod: 'LOCAL',
				}
			});

			return {
				id: user.id,
				username: user.username,
				email: user.email,
				role: user.role,
			};
		} catch (err) {
			console.error(err);
			return reply.code(400).send({ error: 'User already exists or invalid data' });
		}
	});

	fastify.post('/users/google', async (req, reply) => {
		const { googleId, email } = req.body;

		try {
			const existingUser = await prisma.user.findUnique({
				where: { email },
				select: { id: true, username: true, role: true },
			});

			if (existingUser) {
				return existingUser;
			}

			const baseUsername = email.split('@')[0]; // ou un nom issu du profil Google
			const username = await generateUniqueUsername(baseUsername);


			return await prisma.user.create({
				data: {
					googleId,
					email,
					authMethod: 'GOOGLE',
					username: username,
				},
				select: {id: true, username: true, role: true, email: true},
			});
		} catch(err) {
			console.error(err);
			return reply.code(400).send({ error: 'Error creating Google user' });
		}
	});

	fastify.get('/users/internal/:idOrEmail', async (request, reply) => {
		try {
			const { idOrEmail } = request.params;

			let user;

			if (/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(idOrEmail)) {
				user = await prisma.user.findUnique({
					where: { email: idOrEmail },
				});
			} else {
				user = await prisma.user.findUnique({
					where: { username: idOrEmail },
				});
			}

			if (!user) {
				return reply.code(404).send({ error: 'User not found' });
			}

			return {
				id: user.id,
				username: user.username,
				email: user.email,
				password: user.password,
				role: user.role,
				twoFAEnabled: user.twoFAEnabled,
			};
		} catch (err) {
			console.error('Internal user fetch failed:', err);
			return reply.code(500).send({ error: 'Internal Server Error' });
		}
	});

	fastify.patch('/users/:idOrUsername/avatar', async (req, reply) => {
		try {
			const {idOrUsername} = req.params;
			const {avatar} = req.body;

			let where = {};

			if (/^\d+$/.test(idOrUsername)) {
				where = {id: Number(idOrUsername)};
			} else {
				where = {username: idOrUsername};
			}

			return await prisma.user.update({
				where,
				data: {avatar},
				select: {
					id: true,
					username: true,
					avatar: true,
				}
			});
		} catch (err) {
			console.error('Failed to update avatar', err);
			return reply.code(500).send({ error: 'Could not update avatar' });
		}
	});

	fastify.post('/friends/:idOrUsername', async (req, reply) => {
		const { idOrUsername } = req.params;
		const { senderId } = req.body;

		if (!senderId) {
			return reply.code(400).send({ error: 'senderId is required' });
		}

		try {
			let friend = null;

			if (/^\d+$/.test(idOrUsername)) {
				friend = await prisma.user.findUnique({ where: { id: parseInt(idOrUsername) } });
			} else {
				friend = await  prisma.user.findUnique({ where: { username: idOrUsername } });
			}

			if (!friend) {
				return reply.code(404).send({ error: 'User not found' });
			}

			if (friend.id === senderId) {
				return reply.code(400).send({ error: 'You cannot send a friend request to yourself' });
			}

			const existing = await prisma.friendship.findFirst({
				where: {
					OR: [
						{ userId: senderId, friendId: friend.id },
						{ userId: friend.id, friendId: senderId},
					]
				}
			});

			if (existing) {
				return reply.code(409).send({ error: 'Friendship already exists' });
			}

			const friendship = await prisma.friendship.create({
				data: {
					userId: senderId,
					friendId: friend.id,
					status: 'PENDING',
				},
				select: {
					id: true,
					userId: true,
					friendId: true,
					status: true,
					createdAt: true,
				}
			});

			return reply.send(friendship);
		} catch (err) {
			console.error("Friend request error: ", err.message);
			if (err.response) console.error('Response:', err.response.data);
			return reply.code(500).send({ error: 'Could not send friend request' });
		}
	});

	fastify.patch('/friends/:id/accept', async (req, reply) => {
		const { id } = req.params;
		const { userId } = req.body;

		if (!userId) {
			return reply.code(400).send({ error: 'Missing userId' });
		}

		try {
			const friendship = await prisma.friendship.findUnique({
				where: { id: parseInt(id) },
			})

			if (!friendship) {
				return reply.code(404).send({ error: 'Friend request not found' });
			}

			if (friendship.friendId !== userId) {
				return reply.code(403).send({ error: 'You are not authorized to accept this request' });
			}

			if (friendship.status !== 'PENDING') {
				return reply.code(400).send({ error: 'Request is not pending' });
			}

			const updated = await prisma.friendship.update({
				where: { id: parseInt(id) },
				data: { status: 'ACCEPTED' },
				select: {
					id: true,
					userId: true,
					friendId: true,
					status: true,
					createdAt: true,
				}
			});

			return reply.send(updated);
		} catch (err) {
			console.error('Accept friend request error:', err);
			return reply.code(500).send({ error: 'Could not accept friend request' });
		}
	});

	//

	fastify.get('/friends', async (req, reply) => {
		const { userId } = req.query;

		if (!userId) {
			return reply.code(400).send({ error: 'Missing userId' });
		}

		try {
			const friends = await prisma.friendship.findMany({
				where: {
					status: 'ACCEPTED',
					OR: [
						{ userId: parseInt(userId) },
						{ friendId: parseInt(userId) },
					]
				},
				select: {
					id: true,
					userId: true,
					friendId: true,
					user: { select: { id: true, username: true } },
					friend: { select: { id: true, username: true } },
				}
			});

			const formattedFriends = friends.map(f => {
				const isSender = f.userId === parseInt(userId);
				const otherUser = isSender ? f.friend : f.user;
				return {
					friendshipId: f.id,
					friendId: otherUser.id,
					username: otherUser.username
				};
			});

			const pending = await prisma.friendship.findMany({
				where: {
					status: 'PENDING',
					friendId: parseInt(userId),
				},
				select: {
					id: true,
					user: { select: { id: true, username: true } },
				}
			});

			const formattedPending = pending.map(f => ({
				id: f.id,
				from: f.user,
			}));

			return reply.send({
				friends: formattedFriends,
				pendingRequests: formattedPending,
			});
		} catch (err) {
			console.error('Failed to get friend list:', err.message, err.stack);
			return reply.code(500).send({ error: 'Could not fetch friends' });
		}
	});


	fastify.get('/friends/sent', async (req, reply) => {
		const { userId } = req.query;

		if (!userId) {
			return reply.code(400).send({ error: 'Missing userId' });
		}

		try {
			const sent = await prisma.friendship.findMany({
				where: {
					status: 'PENDING',
					userId: parseInt(userId),
				},
				include: {
					friend: { select: { id: true, username: true } },
				}
			});

			const formatted = sent.map(f => ({
				id: f.id,
				to: f.friend,
			}));

			return reply.send({ sentRequests: formatted });
		} catch (err) {
			console.error('Failed to get sent requests:', err);
			return reply.code(500).send({ error: 'Could not fetch sent requests' });
		}
	});

	fastify.delete('/friends/:id', async (req, reply) => {
		const { id } = req.params;
		const { userId } = req.query;

		if (!userId) {
			return reply.code(400).send({ error: 'Missing userId' });
		}

		try {
			const friendship = await prisma.friendship.findUnique({
				where: { id: parseInt(id) },
			});

			if (!friendship) {
				return reply.code(404).send({ error: 'Friendship not found' });
			}

			const isInvolved = [friendship.userId, friendship.friendId].includes(parseInt(userId));
			if (!isInvolved) {
				return reply.code(403).send({ error: 'Not authorized to delete this friendship' });
			}

			await prisma.friendship.delete({
				where: { id: parseInt(id) },
			});

			return reply.send({ message: 'Friend deleted successfully' });
		} catch (err) {
			console.error('Failed to delete friendship:', err);
			return reply.code(500).send({ error: 'Could not delete friendship' });
		}
	});

	fastify.patch('/users/:idOrUsername', async (req, reply) => {
		const { idOrUsername } = req.params;
		const { username, biography, password, twoFAEnabled, twoFASecret } = req.body;

		try {
			let user;
			if (/^\d+$/.test(idOrUsername)) {
				user = await prisma.user.findUnique({ where: { id: Number(idOrUsername) } });
			} else {
				user = await prisma.user.findUnique({ where: { username: idOrUsername } });
			}

			if (!user) {
				return reply.code(404).send({ error: 'User not found' });
			}

			// Vérifie si le nouveau username est déjà pris
			if (username && username !== user.username) {
				const existing = await prisma.user.findUnique({ where: { username } });
				if (existing && existing.id !== user.id) {
					return reply.code(409).send({ error: 'Username already taken' });
				}
			}

			const updateData = {};
			if (username) updateData.username = username;
			if (biography) updateData.biography = biography;
			if (password) updateData.password = password;
			if (twoFASecret) updateData.twoFASecret = twoFASecret;
			if (twoFAEnabled) updateData.twoFAEnabled = twoFAEnabled;

			const updatedUser = await prisma.user.update({
				where: { id: user.id },
				data: updateData,
				select: {
					id: true,
					username: true,
					biography: true,
					avatar: true,
				},
			});

			return reply.send(updatedUser);
		} catch (err) {
			req.log.error('DB update failed:', err);
			return reply.code(500).send({
				error: 'DB: Failed to update user',
				message: err.message,
				stack: err.stack,
			});
		}
	});

	fastify.patch('/users/2fa/:id', async (req, reply) => {
		const userId = parseInt(req.params.id, 10);
		const { twoFASecret, twoFAEnabled } = req.body;

		try {
			const updated = await prisma.user.update({
				where: { id: userId },
				data: {
					...(twoFASecret !== undefined && { twoFASecret }),
					...(twoFAEnabled !== undefined && { twoFAEnabled }),
				},
			});
			return reply.send(updated);
		} catch (err) {
			req.log.error('DB update failed:', err);
			return reply.code(500).send({ error: 'Failed to update user' });
		}
	});

	fastify.get('/users/2fa/:id', async (req, reply) => {
		const userId = parseInt(req.params.id, 10);

		try {
			const user = await prisma.user.findUnique({
				where: { id: userId },
			});

			if (!user) return reply.code(404).send({ error: 'User not found' });

			return reply.send({ user });
		} catch (err) {
			req.log.error(err);
			return reply.code(500).send({ error: 'Failed to fetch user' });
		}
	});

	// RGPD fields

	fastify.post('/users/:id/anonymize', async (req, reply) => {
		const userId = parseInt(req.params.id, 10);

		if (isNaN(userId)) {
			return reply.code(400).send({ error: 'Invalid user ID' });
		}

		try {
			const anonymized = await prisma.user.update({
				where: { id: userId },
				data: {
					username: `deleted_user_${userId}`,
					email: `deleted_user_${userId}@example.com`,
					avatar: null,
					biography: null,
					anonymized: true,
					deletedAt: new Date(),
				},
				select: {
					id: true,
					username: true,
					email: true,
					anonymized: true,
				}
			});
			return reply.send(anonymized);
		} catch (err) {
			console.error('Anonymize failed:', err);
			req.log.error('Anonymization failed:', err);
			return reply.code(500).send({ error: 'Anonymization failed', details: err.message });
		}
	});

	fastify.get('/users/:id/settings', async (req, reply) => {
		const userId = parseInt(req.params.id, 10);

		if (isNaN(userId)) {
			return reply.code(400).send({ error: 'Invalid user ID' });
		}

		try {
			const settings = await prisma.userSettings.findUnique({
				where: { userId },
			});

			if (!settings) {
				return reply.code(404).send({ error: 'Settings not found' });
			}

			return reply.send(settings);
		} catch (err) {
			console.error('Failed to get settings:', err);
			return reply.code(500).send({ error: 'Could not fetch settings' });
		}
	});

	fastify.post('/users/:id/settings', async (req, reply) => {
		const userId = parseInt(req.params.id, 10);
		const { background, paddle, ball, divider, score } = req.body;

		if (isNaN(userId)) {
			return reply.code(400).send({ error: 'Invalid user ID' });
		}

		try {
			const existing = await prisma.userSettings.findUnique({
				where: { userId },
			});
			if (existing) {
				return reply.code(409).send({ error: 'Settings already exists for this user' });
			}

			const settings = await prisma.userSettings.create({
				data: {
					userId,
					background,
					paddle,
					ball,
					divider,
					score,
				},
			});

			return reply.code(201).send(settings);
		} catch (err) {
			console.error('Failed to create settings:', err);
			return reply.code(500).send({ error: 'Could not create settings' });
		}
	});

	fastify.patch('/users/:id/settings', async (req, reply) => {
		const userId = parseInt(req.params.id, 10);
		const { background, paddle, ball, divider, score } = req.body;

		if (isNaN(userId)) {
			return reply.code(400).send({ error: 'Invalid user ID' });
		}

		try {
			const updated = await prisma.userSettings.update({
				where: { userId },
				data: {
					...(background !== undefined && { background }),
					...(paddle !== undefined && { paddle }),
					...(ball !== undefined && { ball }),
					...(divider !== undefined && { divider }),
					...(score !== undefined && { score }),
				}
			});

			return reply.send(updated);
		} catch (err) {
			console.error('Failed to update settings:', err);
			return reply.code(500).send({ error: 'Could not update settings' });
		}
	})

};
