const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async function (fastify, opts) {

	fastify.get('/users', async (request, reply) => {
		return prisma.user.findMany();
	});

	fastify.get('/users/:idOrUsername', async (request, reply) => {
		const { idOrUsername } = request.params;

		let user;

		if (/^\d+$/.test(idOrUsername)) {
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

	fastify.post('/users', async (request, reply) => {
		const { username } = request.body;
		try {
			const user = await prisma.user.create({
				data: {
					username
				}
			});
			return { id: user.id };
		} catch (err) {
			console.error(err)
			reply.code(400).send({ error: 'User already exists or invalid data'});
		}
	});
};
