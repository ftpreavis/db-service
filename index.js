const fastify = require('fastify')({ logger: true });
const metricsPlugin = require('fastify-metrics')

fastify.register(metricsPlugin, { endpoint: '/metrics' })

fastify.register(require('./routes/user'));

fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}
	fastify.log.info(`Server listening at ${address}`);
});
