import { calculateDriverScore } from './scoring_algorithm.js';

// Stocke l'état des dispatches en cours
const activeDispatches = new Map();

/**
 * Lance l'attribution intelligente pour une nouvelle commande
 * @param {Object} order Commande créée (déjà convertie en camelCase par fromSnake)
 * @param {import('pg').Pool} pool
 * @param {import('socket.io').Server} io
 */
export async function startSmartDispatch(order, pool, io) {
    if (!order.id) return;

    console.log(`🚀 Smart Dispatch pour la commande #${order.id}`);

    try {
        // 1. Livreurs disponibles (approuvés, non suspendus, en ligne)
        const { rows: drivers } = await pool.query(`
            SELECT id, full_name, phone, rating, is_online
            FROM users
            WHERE role = 'livreur' AND is_approved = true AND is_suspended = false AND is_online = true
        `);

        if (drivers.length === 0) {
            console.log(`⚠️ Aucun livreur dispo #${order.id} → Broadcast.`);
            io.emit('realtime:orders', { eventType: 'INSERT', new: order });
            return;
        }

        // 2. Stats du jour pour l'équité
        const { rows: stats } = await pool.query(`
            SELECT driver_id, COUNT(id)::int AS courses_today
            FROM orders
            WHERE status IN ('delivered', 'confirmed') AND created_at >= CURRENT_DATE
            GROUP BY driver_id
        `);
        const statsMap = new Map(stats.map(s => [s.driver_id, s.courses_today]));

        // Coordonnées par défaut (Douala centre)
        const defaultLat = 4.0511;
        const defaultLng = 9.7679;

        const formattedDrivers = drivers.map(d => ({
            id: d.id,
            location: { lat: defaultLat, lng: defaultLng },
            stats: {
                ordersCompletedToday: statsMap.get(d.id) || 0,
                acceptanceRate: 1.0,
                cancellationRate: 0.0,
                rating: parseFloat(d.rating) || 5.0
            }
        }));

        const orderPickup = { pickupLocation: { lat: defaultLat, lng: defaultLng } };

        // 3. Calcul et tri par score
        const scoredDrivers = formattedDrivers
            .map(d => calculateDriverScore(d, orderPickup))
            .sort((a, b) => b.totalScore - a.totalScore);

        console.log(`📊 Scores #${order.id}:`, scoredDrivers.map(d => `${d.driverId?.slice(0, 8)} (${d.totalScore})`));

        // 4. File de Ping
        const driverQueue = scoredDrivers.map(d => d.driverId);
        activeDispatches.set(order.id, { order, queue: driverQueue, currentIndex: 0, timer: null });

        pingNextDriver(order.id, io, pool);
    } catch (err) {
        console.error('Erreur startSmartDispatch:', err);
        io.emit('realtime:orders', { eventType: 'INSERT', new: order });
    }
}

function pingNextDriver(orderId, io, _pool) {
    const dispatch = activeDispatches.get(orderId);
    if (!dispatch) return;

    if (dispatch.currentIndex >= dispatch.queue.length) {
        console.log(`🚨 Fin de file #${orderId} → Broadcast.`);
        io.emit('realtime:orders', { eventType: 'INSERT', new: dispatch.order });
        activeDispatches.delete(orderId);
        return;
    }

    const currentDriverId = dispatch.queue[dispatch.currentIndex];
    const timeoutSec = 15;

    console.log(`🔔 Ping #${orderId} → ${currentDriverId?.slice(0, 8)} (${timeoutSec}s)`);

    io.to(`user:${currentDriverId}`).emit('ping_order_dispatch', { order: dispatch.order, timeout: timeoutSec });

    dispatch.timer = setTimeout(() => {
        console.log(`⏱️ Timeout #${orderId} ${currentDriverId?.slice(0, 8)}`);
        io.to(`user:${currentDriverId}`).emit('ping_order_expired', { orderId });
        dispatch.currentIndex++;
        pingNextDriver(orderId, io, _pool);
    }, timeoutSec * 1000);
}

/**
 * Gère la réponse d'un livreur (acceptation ou refus)
 */
export async function handleDriverPingResponse(socket, io, pool, { orderId, driverId, accepted }) {
    const dispatch = activeDispatches.get(orderId);
    if (!dispatch) return;

    const expectedDriverId = dispatch.queue[dispatch.currentIndex];
    if (driverId !== expectedDriverId) return;

    clearTimeout(dispatch.timer);

    if (accepted) {
        console.log(`✅ Livreur ${driverId?.slice(0, 8)} a accepté #${orderId}`);
        activeDispatches.delete(orderId);

        try {
            await pool.query(
                `UPDATE orders SET driver_id = $1, status = 'confirmed', confirmed_at = now(), updated_at = now() WHERE id = $2`,
                [driverId, orderId]
            );

            const { rows: [updatedRow] } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);

            io.emit('realtime:orders', { eventType: 'UPDATE', new: updatedRow });
            io.to(`user:${driverId}`).emit('ping_order_success', { orderId });
        } catch (err) {
            console.error("Erreur acceptation commande:", err);
        }
    } else {
        console.log(`❌ Livreur ${driverId?.slice(0, 8)} a refusé #${orderId}`);
        dispatch.currentIndex++;
        pingNextDriver(orderId, io, pool);
    }
}
