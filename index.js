const fastify = require('fastify')({ logger: true });

fastify.register(require('./routes/user'));

fastify.listen({ port: 5432 }, (err, address) => {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}
	fastify.log.info(`Server listening at ${address}`);
});
