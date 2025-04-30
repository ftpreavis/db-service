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

		if (/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(idOrUsername)) {
			// Search by email
			user = await prisma.user.findUnique({
				where: {email: idOrUsername},
				include: {stats: true}
			});
		} else if (/^\d+$/.test(idOrUsername)) {
			// Search by id or username
			user = await prisma.user.findUnique({
				where: { id: Number(idOrUsername) },
				include: { stats: true}
			});
		} else {
			user = await prisma.user.findUnique({
				where: { username: idOrUsername },
				include: { stats: true }
			});
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

			return { id: user.id };
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
			});

			if (existingUser) {
				return { id: existingUser.id };
			}

			const baseUsername = email.split('@')[0]; // ou un nom issu du profil Google
			const username = await generateUniqueUsername(baseUsername);


			const user = await prisma.user.create({
				data: {
					googleId,
					email,
					authMethod: 'GOOGLE',
					username: username,
				}
			});

			return { id: user.id };
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
			};
		} catch (err) {
			console.error('Internal user fetch failed:', err);
			return reply.code(500).send({ error: 'Internal Server Error' });
		}
	});

};
