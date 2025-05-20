const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = async function (fastify, opts) {
	fastify.post('/messages', async (req, reply) => {
		const { senderId, receiverId, content } = req.body;

		try {
			const isBlocked = await prisma.blockedUser.findUnique({
				where: {
					blockerId_blockedId: {
						blockerId: receiverId,
						blockedId: senderId,
					},
				},
			});

			if (isBlocked) {
				return reply.code(403).send({ error: 'Receiver blocked sender.' });
			}

			const hasBlocked = await prisma.blockedUser.findUnique({
				where: {
					blockerId_blockedId: {
						blockerId: senderId,
						blockedId: receiverId,
					},
				},
			});

			if (hasBlocked) {
				return reply.code(403).send({ error: 'Sender blocked receiver.' });
			}

			const message = await prisma.message.create({
				data: {
					senderId,
					receiverId,
					content,
				},
				include: {
					sender: { select: { id: true, username: true } },
					receiver: { select: { id: true, username: true } },
				},
			});

			return reply.send(message);
		} catch (err) {
			console.error('Error sending message:', err);
			return reply.code(500).send({ error: 'Could not send message.' });
		}
	});

	fastify.get('/messages/:userId', async (req, reply) => {
		const currentUserId = parseInt(req.query.userId);
		const otherUserId = parseInt(req.params.userId);
		const take = parseInt(req.query.take) * 50 || 50;
		const skip = parseInt(req.query.skip) * 50 || 0;

		if (!currentUserId || isNaN(otherUserId)) {
			return reply.code(400).send({ error: 'Invalid userId(s)' })
		}

		try {
			const messages = await prisma.message.findMany({
				where: {
					OR: [
						{ senderId: currentUserId, receiverId: otherUserId },
						{ senderId: otherUserId, receiverId: currentUserId },
					],
				},
				orderBy: { createdAt: 'asc' },
				take,
				skip
			});

			return reply.send(messages);
		} catch (err) {
			console.error('Error getting messages:', err);
			return reply.code(500).send({ error: 'Could not fetch messages' });
		}
	});

	fastify.patch('/messages/read', async (req, reply) => {
		const { senderId, userId } = req.body;
		try {
			await prisma.message.updateMany({
				where: {
					senderId: senderId,
					receiverId: userId,
					read: false
				},
				data: { read: true },
			});

			return reply.send({ success: true });
		} catch (err) {
			console.error('Failed to mark read:', err);
			return reply.code(500).send({ error: 'Could not mark messages as read' });
		}
	});

	fastify.get('/messages/unread/total', async (req, reply) => {
		const { userId } = req.query;

		if (!userId) {
			return reply.code(400).send({ error: 'Missing userId' });
		}

		try {
			const count = await prisma.message.count({
				where: {
					receiverId: parseInt(userId),
					read: false
				}
			});

			return reply.send({ count });
		} catch (err) {
			console.error('Error fetching total unread count:', err);
			return reply.code(500).send({ error: 'Could not get unread total' });
		}
	});

	fastify.get('/messages/unread/by-conversation', async (req, reply) => {
		const { userId } = req.query;
		const parsedId = parseInt(userId);

		if (!parsedId) {
			return reply.code(400).send({ error: 'Missing or invalid userId' });
		}

		try {
			const counts = await prisma.message.groupBy({
				by: ['senderId'],
				where: {
					receiverId: parseId,
					read: false
				},
				_count: {
					_all: true
				}
			});

			const result = counts.map(entry => ({
				fromUserId: entry.senderId,
				count: entry._count._all
			}));

			return reply.send(result);
		} catch (err) {
			console.error('Error getting unread messages per conversation:', err);
			return reply.code(500).send({ error: 'Could not fetch unread messages per conversation' })
		}
	});

	fastify.post('/block', async (req, reply) => {
		const { blockerId, blockedId } = req.body;

		try {
			const result = await prisma.blockedUser.upsert({
				where: {
					blockerId_blockedId: {
						blockerId,
						blockedId,
					},
				},
				create: {
					blockerId,
					blockedId,
				},
				update: {},
			});

			return reply.send(result);
		} catch (err) {
			console.error('Error blocking user:', err);
			return reply.code(500).send({ error: 'Could not block user' });
		}
	});

	fastify.delete('/block', async (req, reply) => {
		const { blockerId, blockedId } = req.body;

		try {
			await prisma.blockedUser.delete({
				where: {
					blockerId_blockedId: {
						blockerId,
						blockedId,
					},
				},
			});

			return reply.send({ message: 'User unblocked successfully.' });
		} catch (err) {
			console.error('Error unblocking user:', err);
			return reply.code(500).send({ error: 'Could not unblock user' });
		}
	});

	fastify.get('/block', async (req, reply) => {
		const { userId } = req.query;

		if (!userId) {
			return reply.code(400).send({ error: 'Missing userId' });
		}

		try {
			const blocked = await prisma.blockedUser.findMany({
				where: { blockerId: parseInt(userId) },
				include: {
					blocked: {
						select: { id: true, username: true },
					},
				},
			});

			return reply.send(blocked.map((entry) => entry.blocked));
		} catch (err) {
			console.log('Error getting blocked users:', err);
			return reply.code(500).send({ error: 'Could not fetch blocked users' });
		}
	});

	fastify.get('/conversations', async (req, reply) => {
		const { userId } = req.query;
		const currentUserId = parseInt(userId);

		if (!currentUserId) {
			return reply.code(400).send({ error: 'Missing or invalid userId' });
		}

		try {
			const messages = await prisma.message.findMany({
				where: {
					OR: [
						{ senderId: currentUserId },
						{ receiverId: currentUserId }
					]
				},
				orderBy: {
					createdAt: 'desc'
				}
			});

			const seen = new Set();
			const conversations = [];

			for (const m of messages) {
				const otherId = m.senderId === currentUserId ? m.receiverId : m.senderId;
				if (!seen.has(otherId)) {
					seen.add(otherId);
					conversations.push({
						id: m.id,
						content: m.content,
						createdAt: m.createdAt,
						userId: otherId
					});
				}
			}

			return reply.send(conversations);
		} catch (err) {
			console.error('Error loading fallback conversations:', err);
			return reply.code(500).send({ error: 'Could not fetch conversations' });
		}
	});
}
