// Demo data for the menu database. The cafés are fictional; the districts are real Stockholm areas.
// Load from the menu server:  mongosh --host <MONGODB-HOST> </app/db/menu-data.js
db = db.getSiblingDB('menu');
db.cafes.drop();
db.items.drop();

db.cafes.insertMany([
  { id: 'bullhornan', name: 'Bullhörnan', district: 'Södermalm', lat: 59.3166, lon: 18.0719, about: 'Cinnamon buns straight from the oven, since 6 am.' },
  { id: 'kardemumma', name: 'Kafé Kardemumma', district: 'Vasastan', lat: 59.3437, lon: 18.0469, about: 'Cardamom everything, and very good filter coffee.' },
  { id: 'stromkaffe', name: 'Strömkaffe', district: 'Gamla stan', lat: 59.3251, lon: 18.0711, about: 'A tiny café in the old town, with a view of the water.' },
  { id: 'kungsholms', name: 'Kungsholms Fikabod', district: 'Kungsholmen', lat: 59.3326, lon: 18.0335, about: 'Cakes for every kalas, and oat milk for everyone.' },
  { id: 'ostermalms', name: 'Östermalms Kakverkstad', district: 'Östermalm', lat: 59.3378, lon: 18.0833, about: 'Classic Swedish cakes, made the slow way.' },
  { id: 'hasselby', name: 'Strandbageriet', district: 'Hässelby', lat: 59.3615, lon: 17.8325, about: 'Lakeside bakery by Mälaren, worth the trip out west.' }
]);

const items = [
  ['bullhornan', 'BH-KANEL', 'Kanelbulle', 'Cinnamon bun with pearl sugar', 'bun', 42, 60],
  ['bullhornan', 'BH-KARDE', 'Kardemummabulle', 'Cardamom knot, sticky and soft', 'bun', 45, 40],
  ['bullhornan', 'BH-6PACK', 'Kanelbullar, 6-pack', 'Six buns in a paper bag, for the office', 'bun', 219, 15],
  ['bullhornan', 'BH-BRYGG', 'Bryggkaffe', 'Filter coffee, refill (påtår) included', 'coffee', 38, 200],
  ['bullhornan', 'BH-CAPPU', 'Cappuccino', 'Double shot, whole or oat milk', 'coffee', 52, 200],
  ['kardemumma', 'KK-KARDE', 'Kardemummabulle', 'The house speciality', 'bun', 46, 50],
  ['kardemumma', 'KK-CHOKL', 'Chokladboll', 'Oats, cocoa and coconut, no baking needed', 'sweet', 32, 40],
  ['kardemumma', 'KK-KLADD', 'Kladdkaka', 'Sticky chocolate cake with whipped cream', 'cake', 55, 20],
  ['kardemumma', 'KK-FILTR', 'Filterkaffe', 'Light roast from a Stockholm roastery', 'coffee', 39, 200],
  ['stromkaffe', 'SK-SEMLA', 'Semla', 'Cardamom bun, almond paste and cream (seasonal)', 'bun', 59, 25],
  ['stromkaffe', 'SK-MOROT', 'Morotskaka', 'Carrot cake with cream-cheese frosting', 'cake', 62, 18],
  ['stromkaffe', 'SK-LATTE', 'Oat latte', 'Oat milk, double shot', 'coffee', 58, 150],
  ['stromkaffe', 'SK-KANEL', 'Kanelbulle', 'Old-town recipe, extra cinnamon', 'bun', 44, 35],
  ['kungsholms', 'KF-PRINS', 'Prinsesstårta', 'A slice of the green princess cake', 'cake', 69, 16],
  ['kungsholms', 'KF-DAMMS', 'Dammsugare', 'Green marzipan roll with chocolate ends', 'sweet', 36, 30],
  ['kungsholms', 'KF-KANEL', 'Kanelbulle', 'Vegan cinnamon bun', 'bun', 43, 40],
  ['kungsholms', 'KF-CORTA', 'Cortado', 'Short and strong', 'coffee', 45, 150],
  ['ostermalms', 'OK-PRINS', 'Prinsesstårta', 'Whole cake for 8, order a day ahead', 'cake', 495, 4],
  ['ostermalms', 'OK-BISKV', 'Biskvi', 'Almond base, chocolate buttercream', 'sweet', 42, 30],
  ['ostermalms', 'OK-TOSCA', 'Toscakaka', 'Almond and caramel cake', 'cake', 58, 20],
  ['ostermalms', 'OK-ESPRE', 'Espresso', 'Single origin', 'coffee', 36, 150],
  ['hasselby', 'HS-KANEL', 'Kanelbulle', 'Baked at dawn, still warm at nine', 'bun', 40, 50],
  ['hasselby', 'HS-VANIL', 'Vaniljbulle', 'Vanilla custard bun with sugar on top', 'bun', 45, 30],
  ['hasselby', 'HS-MAZAR', 'Mazarin', 'Almond tart with a thin icing', 'sweet', 39, 25],
  ['hasselby', 'HS-BRYGG', 'Bryggkaffe', 'Filter coffee to take down to the water', 'coffee', 35, 200],
  ['hasselby', 'HS-LATTE', 'Café latte', 'Whole or oat milk', 'coffee', 49, 150]
];
db.items.insertMany(items.map(([cafe, sku, name, description, category, price, stock]) => ({ cafe, sku, name, description, category, price, stock })));

db.items.createIndex({ sku: 1 }, { unique: true });
db.items.createIndex({ cafe: 1 });
print('menu: ' + db.cafes.countDocuments() + ' cafés, ' + db.items.countDocuments() + ' items');
