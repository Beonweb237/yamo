/**
 * Module de calcul du Score d'Attribution pour le système Smart Dispatch.
 * Ce script peut être utilisé dans votre backend Node.js.
 */

// Poids des différents critères (Le total doit faire 100)
const WEIGHTS = {
    PROXIMITY: 40,   // 40% d'importance pour la distance
    EQUITY: 30,      // 30% d'importance pour l'équité des revenus/commandes
    PERFORMANCE: 30  // 30% d'importance pour la note et la fiabilité
};

// Paramètres de configuration du système
const CONFIG = {
    MAX_RADIUS_KM: 5,        // Rayon maximal de recherche en kilomètres
    TARGET_DAILY_ORDERS: 15, // Objectif cible de commandes par jour pour l'équité (Au-delà, le score d'équité baisse)
};

/**
 * Calcule la distance en kilomètres entre deux points GPS (Formule de Haversine)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Fonction principale : Calcule le score global d'un livreur pour une commande spécifique
 * 
 * @param {Object} driver - Les données du livreur
 * @param {Object} order - Les données de la commande
 * @returns {Number} Le score total sur 100
 */
export function calculateDriverScore(driver, order) {
    // ---------------------------------------------------------
    // 1. CALCUL DE LA PROXIMITÉ (Max: 40 points)
    // ---------------------------------------------------------
    const distanceKm = calculateDistance(
        driver.location.lat, driver.location.lng,
        order.pickupLocation.lat, order.pickupLocation.lng
    );

    let proximityScore = 0;
    if (distanceKm <= CONFIG.MAX_RADIUS_KM) {
        // Plus on est proche de 0 km, plus on se rapproche de 40 points.
        // À 5 km, le score est de 0 point.
        proximityScore = (1 - (distanceKm / CONFIG.MAX_RADIUS_KM)) * WEIGHTS.PROXIMITY;
    }

    // ---------------------------------------------------------
    // 2. CALCUL DE L'ÉQUITÉ (Max: 30 points)
    // ---------------------------------------------------------
    // Un livreur ayant fait 0 commande aura 30 points.
    // Un livreur ayant fait 15 commandes ou plus aura 0 point sur ce critère.
    // Cela permet de distribuer les commandes à ceux qui en ont le plus besoin.
    let equityScore = 0;
    const ordersToday = driver.stats.ordersCompletedToday || 0;

    if (ordersToday < CONFIG.TARGET_DAILY_ORDERS) {
        equityScore = (1 - (ordersToday / CONFIG.TARGET_DAILY_ORDERS)) * WEIGHTS.EQUITY;
    }

    // ---------------------------------------------------------
    // 3. CALCUL DE LA PERFORMANCE (Max: 30 points)
    // ---------------------------------------------------------
    // On combine le taux d'acceptation, le taux d'annulation (inversé) et la note client
    const acceptanceRate = driver.stats.acceptanceRate || 0; // De 0.0 à 1.0 (ex: 0.95 pour 95%)
    const cancellationRate = driver.stats.cancellationRate || 0; // De 0.0 à 1.0 (ex: 0.02 pour 2%)
    const rating = driver.stats.rating || 5; // De 1 à 5 étoiles

    // On transforme la note sur 5 en pourcentage (0.0 à 1.0)
    const normalizedRating = rating / 5;

    // Le taux d'achèvement (completion rate) est l'inverse du taux d'annulation
    const completionRate = 1 - cancellationRate;

    // Sous-pondération interne des performances : 
    // 40% pour l'acceptation, 40% pour ne pas annuler, 20% pour la note client
    const performanceFactor = (acceptanceRate * 0.4) + (completionRate * 0.4) + (normalizedRating * 0.2);

    const performanceScore = performanceFactor * WEIGHTS.PERFORMANCE;

    // ---------------------------------------------------------
    // SCORE FINAL
    // ---------------------------------------------------------
    const totalScore = proximityScore + equityScore + performanceScore;

    return {
        driverId: driver.id,
        totalScore: Math.round(totalScore * 100) / 100, // Arrondi à 2 décimales
        details: {
            distanceKm: Math.round(distanceKm * 100) / 100,
            proximityScore: Math.round(proximityScore * 100) / 100,
            equityScore: Math.round(equityScore * 100) / 100,
            performanceScore: Math.round(performanceScore * 100) / 100
        }
    };
}

// --- TEST (exécuté uniquement en direct) ---
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
    const sampleOrder = {
        pickupLocation: { lat: 4.0511, lng: 9.7679 } // Exemple: Douala (Akwa)
    };

    const drivers = [
        {
            id: "LIVREUR_A", // Le livreur proche mais qui a déjà beaucoup gagné aujourd'hui
            location: { lat: 4.0520, lng: 9.7680 }, // Très proche (environ 100m)
            stats: { ordersCompletedToday: 12, acceptanceRate: 0.90, cancellationRate: 0.05, rating: 4.8 }
        },
        {
            id: "LIVREUR_B", // Le livreur un peu plus loin mais qui n'a rien gagné aujourd'hui
            location: { lat: 4.0600, lng: 9.7700 }, // Plus loin (environ 1km)
            stats: { ordersCompletedToday: 1, acceptanceRate: 1.0, cancellationRate: 0.0, rating: 5.0 }
        }
    ];

    console.log("--- RÉSULTATS DU SMART DISPATCH ---");
    drivers.forEach(driver => {
        const score = calculateDriverScore(driver, sampleOrder);
        console.log(`Livreur ${score.driverId} : Score Total = ${score.totalScore}/100`);
        console.log(`  -> Proximité: ${score.details.proximityScore}/40 (${score.details.distanceKm} km)`);
        console.log(`  -> Équité: ${score.details.equityScore}/30`);
        console.log(`  -> Performance: ${score.details.performanceScore}/30`);
        console.log("-----------------------------------");
    });
}
