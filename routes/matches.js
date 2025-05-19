const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async function (fastify, opts) {

    fastify.get('/matches', async (req, res) => {
        try {
            return await  prisma.match.findMany({
                select: {
                    id: true,
                    player1: {
                        select: {
                            id: true,
                            username: true,
                        }
                    },
                    player2: {
                        select: {
                            id: true,
                            username: true,
                        }
                    },
                    player1Score: true,
                    player2Score: true,
                    status: true,
                }
            });
        } catch (err) {
            console.error('Error fetching matches', err);
            return res.code(500).send({ error: 'Internal Server Error' });
        }
    });

    fastify.get('/matches/:playerId', async (req, res) => {
        const playerId = parseInt(req.params.playerId, 10);

        if (isNaN(playerId)) {
            return res.code(400).send({ error: 'Invalid playerId provided' });
        }

        try {
            const matches = await prisma.match.findMany({
                where: {
                    OR: [
                        { player1Id: playerId },
                        { player2Id: playerId },
                    ]
                },
                select: {
                    id: true,
                    player1: {
                        select: {
                            id: true,
                            username: true,
                        }
                    },
                    player2: {
                        select: {
                            id: true,
                            username: true,
                        }
                    },
                    player1Score: true,
                    player2Score: true,
                    status: true,
                    playedAt: true,
                },
                orderBy: {
                    playedAt: 'desc'
                }
            });
            return res.send(matches);
        } catch (err) {
            console.error('Error fetching player matches', err);
            return res.code(500).send({ error: 'Internal Server Error' });
        }
    })
}