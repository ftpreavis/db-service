const { PrismaClient } = require('@prisma/client');
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
		return prisma.user.findMany();
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

		if (!user) {
			return reply.code(404).send({ error: 'User not found' });
		}

		return user;
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
};
