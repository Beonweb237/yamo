import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cuisineCategories,
  mealCategoryImages,
  menuItems,
  restaurantMenuCategories,
  restaurants,
} from '../src/data/mockData.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');

const MIN_RESTAURANTS_PER_CUISINE = 3;
const MIN_MENU_ITEMS_PER_CATEGORY = 6;
const GENERIC_MENU_IMAGE_PREFIX = '/cat-';

const errors = [];

function countBy(list, key) {
  return list.reduce((acc, item) => {
    const value = item[key];
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function checkImage(path, context) {
  if (!path) {
    errors.push(`${context}: image manquante`);
    return;
  }
  if (path.startsWith('data:') || path.startsWith('http')) return;
  if (!path.startsWith('/')) {
    errors.push(`${context}: image "${path}" doit commencer par /`);
    return;
  }
  const absolutePath = join(publicDir, path.slice(1));
  if (!existsSync(absolutePath)) {
    errors.push(`${context}: image introuvable ${path}`);
  }
}

const cuisineNames = cuisineCategories.map((category) => category.name);
const cuisineCounts = countBy(restaurants, 'category');
for (const category of cuisineCategories) {
  const count = cuisineCounts[category.name] ?? 0;
  if (count < MIN_RESTAURANTS_PER_CUISINE) {
    errors.push(
      `${category.name}: ${count} restaurant(s), minimum attendu ${MIN_RESTAURANTS_PER_CUISINE}`
    );
  }
  if (!mealCategoryImages[category.name]) {
    errors.push(`${category.name}: image par defaut de categorie manquante`);
  }
}

const unsupportedRestaurantCategories = restaurants
  .map((restaurant) => restaurant.category)
  .filter((category) => !cuisineNames.includes(category));
for (const category of new Set(unsupportedRestaurantCategories)) {
  errors.push(`Categorie restaurant non supportee: ${category}`);
}

const menuCounts = countBy(menuItems, 'category');
for (const category of restaurantMenuCategories) {
  const count = menuCounts[category] ?? 0;
  if (count < MIN_MENU_ITEMS_PER_CATEGORY) {
    errors.push(
      `${category}: ${count} plat(s), minimum attendu ${MIN_MENU_ITEMS_PER_CATEGORY}`
    );
  }
  if (!mealCategoryImages[category]) {
    errors.push(`${category}: image par defaut de categorie manquante`);
  }
}

const supportedMenuCategories = new Set(restaurantMenuCategories);
const unsupportedMenuCategories = menuItems
  .map((item) => item.category)
  .filter((category) => !supportedMenuCategories.has(category));
for (const category of new Set(unsupportedMenuCategories)) {
  errors.push(`Categorie menu non supportee: ${category}`);
}

for (const category of cuisineCategories) {
  checkImage(category.image, `Categorie ${category.name}`);
}
for (const [category, image] of Object.entries(mealCategoryImages)) {
  checkImage(image, `Image par defaut ${category}`);
}
for (const restaurant of restaurants) {
  checkImage(restaurant.image, `Restaurant ${restaurant.name}`);
}
for (const item of menuItems) {
  if (item.image.startsWith(GENERIC_MENU_IMAGE_PREFIX)) {
    errors.push(`Plat ${item.name}: image generique interdite ${item.image}`);
  }
  checkImage(item.image, `Plat ${item.name}`);
}

console.log('Restaurants par categorie:');
for (const category of cuisineCategories) {
  console.log(`  - ${category.name}: ${cuisineCounts[category.name] ?? 0}`);
}

console.log('Plats par categorie:');
for (const category of restaurantMenuCategories) {
  console.log(`  - ${category}: ${menuCounts[category] ?? 0}`);
}

console.log(`Images de plats distinctes: ${new Set(menuItems.map((item) => item.image)).size}`);

if (errors.length) {
  console.error('\nCatalogue invalide:');
  for (const error of errors) {
    console.error(`  ✗ ${error}`);
  }
  process.exit(1);
}

console.log('\nCatalogue valide.');
