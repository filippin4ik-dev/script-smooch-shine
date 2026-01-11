import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Additional skins with accurate prices from CS2 market
const ADDITIONAL_SKINS = [
  // AK-47 skins
  { weapon: 'AK-47', name: 'Vulcan', category: 'Rifle', rarity: 'Covert', price: 8500 },
  { weapon: 'AK-47', name: 'Fire Serpent', category: 'Rifle', rarity: 'Covert', price: 45000 },
  { weapon: 'AK-47', name: 'Fuel Injector', category: 'Rifle', rarity: 'Covert', price: 4200 },
  { weapon: 'AK-47', name: 'Bloodsport', category: 'Rifle', rarity: 'Covert', price: 3800 },
  { weapon: 'AK-47', name: 'The Empress', category: 'Rifle', rarity: 'Covert', price: 3500 },
  { weapon: 'AK-47', name: 'Neon Rider', category: 'Rifle', rarity: 'Covert', price: 2800 },
  { weapon: 'AK-47', name: 'Phantom Disruptor', category: 'Rifle', rarity: 'Classified', price: 850 },
  { weapon: 'AK-47', name: 'Neon Revolution', category: 'Rifle', rarity: 'Covert', price: 2200 },
  { weapon: 'AK-47', name: 'Frontside Misty', category: 'Rifle', rarity: 'Classified', price: 1200 },
  { weapon: 'AK-47', name: 'Point Disarray', category: 'Rifle', rarity: 'Classified', price: 950 },
  { weapon: 'AK-47', name: 'Aquamarine Revenge', category: 'Rifle', rarity: 'Covert', price: 1800 },
  { weapon: 'AK-47', name: 'Jaguar', category: 'Rifle', rarity: 'Covert', price: 2500 },
  { weapon: 'AK-47', name: 'Wasteland Rebel', category: 'Rifle', rarity: 'Covert', price: 3200 },
  { weapon: 'AK-47', name: 'Legion of Anubis', category: 'Rifle', rarity: 'Classified', price: 650 },
  { weapon: 'AK-47', name: 'Rat Rod', category: 'Rifle', rarity: 'Classified', price: 420 },
  { weapon: 'AK-47', name: 'Orbit Mk01', category: 'Rifle', rarity: 'Classified', price: 380 },
  { weapon: 'AK-47', name: 'Safety Net', category: 'Rifle', rarity: 'Restricted', price: 180 },
  { weapon: 'AK-47', name: 'Elite Build', category: 'Rifle', rarity: 'Mil-Spec', price: 85 },
  { weapon: 'AK-47', name: 'Blue Laminate', category: 'Rifle', rarity: 'Classified', price: 320 },
  { weapon: 'AK-47', name: 'Redline', category: 'Rifle', rarity: 'Classified', price: 1100 },
  { weapon: 'AK-47', name: 'Cartel', category: 'Rifle', rarity: 'Classified', price: 280 },
  { weapon: 'AK-47', name: 'First Class', category: 'Rifle', rarity: 'Restricted', price: 150 },
  { weapon: 'AK-47', name: 'Uncharted', category: 'Rifle', rarity: 'Restricted', price: 120 },
  { weapon: 'AK-47', name: 'Safari Mesh', category: 'Rifle', rarity: 'Industrial', price: 25 },
  { weapon: 'AK-47', name: 'Jungle Spray', category: 'Rifle', rarity: 'Industrial', price: 35 },

  // M4A4 skins
  { weapon: 'M4A4', name: 'Howl', category: 'Rifle', rarity: 'Contraband', price: 180000 },
  { weapon: 'M4A4', name: 'Poseidon', category: 'Rifle', rarity: 'Covert', price: 25000 },
  { weapon: 'M4A4', name: 'The Emperor', category: 'Rifle', rarity: 'Covert', price: 3800 },
  { weapon: 'M4A4', name: 'Desolate Space', category: 'Rifle', rarity: 'Covert', price: 2200 },
  { weapon: 'M4A4', name: 'Neo-Noir', category: 'Rifle', rarity: 'Covert', price: 2800 },
  { weapon: 'M4A4', name: 'Buzz Kill', category: 'Rifle', rarity: 'Covert', price: 1500 },
  { weapon: 'M4A4', name: 'Hellfire', category: 'Rifle', rarity: 'Covert', price: 1800 },
  { weapon: 'M4A4', name: 'In Living Color', category: 'Rifle', rarity: 'Covert', price: 2400 },
  { weapon: 'M4A4', name: 'Royal Paladin', category: 'Rifle', rarity: 'Classified', price: 650 },
  { weapon: 'M4A4', name: 'Asiimov', category: 'Rifle', rarity: 'Covert', price: 4500 },
  { weapon: 'M4A4', name: 'Dragon King', category: 'Rifle', rarity: 'Classified', price: 380 },
  { weapon: 'M4A4', name: 'Evil Daimyo', category: 'Rifle', rarity: 'Restricted', price: 95 },
  { weapon: 'M4A4', name: 'Griffin', category: 'Rifle', rarity: 'Restricted', price: 120 },
  { weapon: 'M4A4', name: 'Tooth Fairy', category: 'Rifle', rarity: 'Covert', price: 1200 },
  { weapon: 'M4A4', name: 'Spider Lily', category: 'Rifle', rarity: 'Covert', price: 950 },
  { weapon: 'M4A4', name: 'Temukau', category: 'Rifle', rarity: 'Covert', price: 850 },
  { weapon: 'M4A4', name: 'Magnesium', category: 'Rifle', rarity: 'Restricted', price: 75 },
  { weapon: 'M4A4', name: 'Converter', category: 'Rifle', rarity: 'Mil-Spec', price: 45 },
  { weapon: 'M4A4', name: 'Urban DDPAT', category: 'Rifle', rarity: 'Industrial', price: 28 },
  { weapon: 'M4A4', name: 'Jungle Tiger', category: 'Rifle', rarity: 'Industrial', price: 22 },
  { weapon: 'M4A4', name: 'Faded Zebra', category: 'Rifle', rarity: 'Industrial', price: 18 },

  // M4A1-S skins
  { weapon: 'M4A1-S', name: 'Hot Rod', category: 'Rifle', rarity: 'Covert', price: 8500 },
  { weapon: 'M4A1-S', name: 'Knight', category: 'Rifle', rarity: 'Classified', price: 12000 },
  { weapon: 'M4A1-S', name: 'Master Piece', category: 'Rifle', rarity: 'Covert', price: 8000 },
  { weapon: 'M4A1-S', name: 'Golden Coil', category: 'Rifle', rarity: 'Covert', price: 2800 },
  { weapon: 'M4A1-S', name: 'Mecha Industries', category: 'Rifle', rarity: 'Covert', price: 2200 },
  { weapon: 'M4A1-S', name: 'Chanticos Fire', category: 'Rifle', rarity: 'Covert', price: 1800 },
  { weapon: 'M4A1-S', name: 'Decimator', category: 'Rifle', rarity: 'Covert', price: 1500 },
  { weapon: 'M4A1-S', name: 'Hyper Beast', category: 'Rifle', rarity: 'Covert', price: 3500 },
  { weapon: 'M4A1-S', name: 'Cyrex', category: 'Rifle', rarity: 'Covert', price: 1200 },
  { weapon: 'M4A1-S', name: 'Atomic Alloy', category: 'Rifle', rarity: 'Classified', price: 450 },
  { weapon: 'M4A1-S', name: 'Guardian', category: 'Rifle', rarity: 'Classified', price: 380 },
  { weapon: 'M4A1-S', name: 'Dark Water', category: 'Rifle', rarity: 'Restricted', price: 280 },
  { weapon: 'M4A1-S', name: 'Basilisk', category: 'Rifle', rarity: 'Restricted', price: 95 },
  { weapon: 'M4A1-S', name: 'Nitro', category: 'Rifle', rarity: 'Restricted', price: 120 },
  { weapon: 'M4A1-S', name: 'Leaded Glass', category: 'Rifle', rarity: 'Classified', price: 320 },
  { weapon: 'M4A1-S', name: 'Printstream', category: 'Rifle', rarity: 'Covert', price: 4200 },
  { weapon: 'M4A1-S', name: 'Player Two', category: 'Rifle', rarity: 'Covert', price: 2800 },
  { weapon: 'M4A1-S', name: 'Welcome to the Jungle', category: 'Rifle', rarity: 'Covert', price: 1600 },
  { weapon: 'M4A1-S', name: 'Blue Phosphor', category: 'Rifle', rarity: 'Classified', price: 280 },
  { weapon: 'M4A1-S', name: 'Nightmare', category: 'Rifle', rarity: 'Classified', price: 220 },
  { weapon: 'M4A1-S', name: 'Flashback', category: 'Rifle', rarity: 'Restricted', price: 85 },
  { weapon: 'M4A1-S', name: 'Boreal Forest', category: 'Rifle', rarity: 'Industrial', price: 32 },
  { weapon: 'M4A1-S', name: 'Bright Water', category: 'Rifle', rarity: 'Restricted', price: 150 },

  // AWP skins
  { weapon: 'AWP', name: 'Dragon Lore', category: 'Sniper', rarity: 'Covert', price: 350000 },
  { weapon: 'AWP', name: 'Medusa', category: 'Sniper', rarity: 'Covert', price: 85000 },
  { weapon: 'AWP', name: 'Gungnir', category: 'Sniper', rarity: 'Covert', price: 120000 },
  { weapon: 'AWP', name: 'Asiimov', category: 'Sniper', rarity: 'Covert', price: 8500 },
  { weapon: 'AWP', name: 'Lightning Strike', category: 'Sniper', rarity: 'Covert', price: 12000 },
  { weapon: 'AWP', name: 'Hyper Beast', category: 'Sniper', rarity: 'Covert', price: 3200 },
  { weapon: 'AWP', name: 'Neo-Noir', category: 'Sniper', rarity: 'Covert', price: 2400 },
  { weapon: 'AWP', name: 'Fever Dream', category: 'Sniper', rarity: 'Covert', price: 1600 },
  { weapon: 'AWP', name: 'Containment Breach', category: 'Sniper', rarity: 'Covert', price: 2800 },
  { weapon: 'AWP', name: 'Wildfire', category: 'Sniper', rarity: 'Covert', price: 2200 },
  { weapon: 'AWP', name: 'Oni Taiji', category: 'Sniper', rarity: 'Covert', price: 4500 },
  { weapon: 'AWP', name: 'Graphite', category: 'Sniper', rarity: 'Classified', price: 3800 },
  { weapon: 'AWP', name: 'Corticera', category: 'Sniper', rarity: 'Classified', price: 380 },
  { weapon: 'AWP', name: 'Redline', category: 'Sniper', rarity: 'Classified', price: 420 },
  { weapon: 'AWP', name: 'Electric Hive', category: 'Sniper', rarity: 'Classified', price: 650 },
  { weapon: 'AWP', name: 'Man-o-war', category: 'Sniper', rarity: 'Classified', price: 280 },
  { weapon: 'AWP', name: 'Elite Build', category: 'Sniper', rarity: 'Mil-Spec', price: 65 },
  { weapon: 'AWP', name: 'Worm God', category: 'Sniper', rarity: 'Mil-Spec', price: 55 },
  { weapon: 'AWP', name: 'Phobos', category: 'Sniper', rarity: 'Restricted', price: 95 },
  { weapon: 'AWP', name: 'Pit Viper', category: 'Sniper', rarity: 'Restricted', price: 120 },
  { weapon: 'AWP', name: 'Safari Mesh', category: 'Sniper', rarity: 'Industrial', price: 42 },
  { weapon: 'AWP', name: 'Snake Camo', category: 'Sniper', rarity: 'Industrial', price: 35 },
  { weapon: 'AWP', name: 'The Prince', category: 'Sniper', rarity: 'Covert', price: 1800 },
  { weapon: 'AWP', name: 'Chromatic Aberration', category: 'Sniper', rarity: 'Covert', price: 1400 },
  { weapon: 'AWP', name: 'Duality', category: 'Sniper', rarity: 'Covert', price: 950 },

  // Desert Eagle skins
  { weapon: 'Desert Eagle', name: 'Blaze', category: 'Pistol', rarity: 'Restricted', price: 8500 },
  { weapon: 'Desert Eagle', name: 'Golden Koi', category: 'Pistol', rarity: 'Covert', price: 3200 },
  { weapon: 'Desert Eagle', name: 'Hand Cannon', category: 'Pistol', rarity: 'Covert', price: 2800 },
  { weapon: 'Desert Eagle', name: 'Kumicho Dragon', category: 'Pistol', rarity: 'Covert', price: 1800 },
  { weapon: 'Desert Eagle', name: 'Mecha Industries', category: 'Pistol', rarity: 'Covert', price: 1500 },
  { weapon: 'Desert Eagle', name: 'Code Red', category: 'Pistol', rarity: 'Covert', price: 1200 },
  { weapon: 'Desert Eagle', name: 'Printstream', category: 'Pistol', rarity: 'Covert', price: 2200 },
  { weapon: 'Desert Eagle', name: 'Hypnotic', category: 'Pistol', rarity: 'Restricted', price: 650 },
  { weapon: 'Desert Eagle', name: 'Sunset Storm', category: 'Pistol', rarity: 'Restricted', price: 380 },
  { weapon: 'Desert Eagle', name: 'Conspiracy', category: 'Pistol', rarity: 'Classified', price: 280 },
  { weapon: 'Desert Eagle', name: 'Crimson Web', category: 'Pistol', rarity: 'Classified', price: 420 },
  { weapon: 'Desert Eagle', name: 'Naga', category: 'Pistol', rarity: 'Restricted', price: 150 },
  { weapon: 'Desert Eagle', name: 'Pilot', category: 'Pistol', rarity: 'Restricted', price: 95 },
  { weapon: 'Desert Eagle', name: 'Urban Rubble', category: 'Pistol', rarity: 'Industrial', price: 28 },
  { weapon: 'Desert Eagle', name: 'Mudder', category: 'Pistol', rarity: 'Industrial', price: 22 },
  { weapon: 'Desert Eagle', name: 'Night', category: 'Pistol', rarity: 'Industrial', price: 35 },
  { weapon: 'Desert Eagle', name: 'Fennec Fox', category: 'Pistol', rarity: 'Covert', price: 850 },
  { weapon: 'Desert Eagle', name: 'Ocean Drive', category: 'Pistol', rarity: 'Covert', price: 750 },

  // USP-S skins
  { weapon: 'USP-S', name: 'Kill Confirmed', category: 'Pistol', rarity: 'Covert', price: 4500 },
  { weapon: 'USP-S', name: 'Neo-Noir', category: 'Pistol', rarity: 'Covert', price: 2200 },
  { weapon: 'USP-S', name: 'Cortex', category: 'Pistol', rarity: 'Covert', price: 1800 },
  { weapon: 'USP-S', name: 'Caiman', category: 'Pistol', rarity: 'Classified', price: 380 },
  { weapon: 'USP-S', name: 'Orion', category: 'Pistol', rarity: 'Covert', price: 3200 },
  { weapon: 'USP-S', name: 'Guardian', category: 'Pistol', rarity: 'Classified', price: 280 },
  { weapon: 'USP-S', name: 'Dark Water', category: 'Pistol', rarity: 'Restricted', price: 220 },
  { weapon: 'USP-S', name: 'Stainless', category: 'Pistol', rarity: 'Classified', price: 180 },
  { weapon: 'USP-S', name: 'Road Rash', category: 'Pistol', rarity: 'Classified', price: 320 },
  { weapon: 'USP-S', name: 'Serum', category: 'Pistol', rarity: 'Restricted', price: 85 },
  { weapon: 'USP-S', name: 'Blueprint', category: 'Pistol', rarity: 'Restricted', price: 95 },
  { weapon: 'USP-S', name: 'Torque', category: 'Pistol', rarity: 'Mil-Spec', price: 45 },
  { weapon: 'USP-S', name: 'Royal Blue', category: 'Pistol', rarity: 'Industrial', price: 32 },
  { weapon: 'USP-S', name: 'Forest Leaves', category: 'Pistol', rarity: 'Consumer', price: 18 },
  { weapon: 'USP-S', name: 'Printstream', category: 'Pistol', rarity: 'Covert', price: 2800 },
  { weapon: 'USP-S', name: 'The Traitor', category: 'Pistol', rarity: 'Covert', price: 1500 },
  { weapon: 'USP-S', name: 'Whiteout', category: 'Pistol', rarity: 'Classified', price: 850 },
  { weapon: 'USP-S', name: 'Monster Mashup', category: 'Pistol', rarity: 'Classified', price: 420 },
  { weapon: 'USP-S', name: 'Ticket to Hell', category: 'Pistol', rarity: 'Covert', price: 950 },

  // Glock-18 skins
  { weapon: 'Glock-18', name: 'Fade', category: 'Pistol', rarity: 'Restricted', price: 12000 },
  { weapon: 'Glock-18', name: 'Dragon Tattoo', category: 'Pistol', rarity: 'Restricted', price: 1200 },
  { weapon: 'Glock-18', name: 'Water Elemental', category: 'Pistol', rarity: 'Covert', price: 850 },
  { weapon: 'Glock-18', name: 'Twilight Galaxy', category: 'Pistol', rarity: 'Covert', price: 650 },
  { weapon: 'Glock-18', name: 'Wasteland Rebel', category: 'Pistol', rarity: 'Classified', price: 380 },
  { weapon: 'Glock-18', name: 'Steel Disruption', category: 'Pistol', rarity: 'Restricted', price: 180 },
  { weapon: 'Glock-18', name: 'Grinder', category: 'Pistol', rarity: 'Mil-Spec', price: 95 },
  { weapon: 'Glock-18', name: 'Brass', category: 'Pistol', rarity: 'Restricted', price: 280 },
  { weapon: 'Glock-18', name: 'Royal Legion', category: 'Pistol', rarity: 'Classified', price: 220 },
  { weapon: 'Glock-18', name: 'Weasel', category: 'Pistol', rarity: 'Classified', price: 150 },
  { weapon: 'Glock-18', name: 'Bunsen Burner', category: 'Pistol', rarity: 'Restricted', price: 85 },
  { weapon: 'Glock-18', name: 'Moonrise', category: 'Pistol', rarity: 'Classified', price: 280 },
  { weapon: 'Glock-18', name: 'Off World', category: 'Pistol', rarity: 'Restricted', price: 120 },
  { weapon: 'Glock-18', name: 'Reactor', category: 'Pistol', rarity: 'Classified', price: 320 },
  { weapon: 'Glock-18', name: 'Sand Dune', category: 'Pistol', rarity: 'Consumer', price: 15 },
  { weapon: 'Glock-18', name: 'Groundwater', category: 'Pistol', rarity: 'Consumer', price: 12 },
  { weapon: 'Glock-18', name: 'Night', category: 'Pistol', rarity: 'Industrial', price: 28 },
  { weapon: 'Glock-18', name: 'Candy Apple', category: 'Pistol', rarity: 'Restricted', price: 450 },
  { weapon: 'Glock-18', name: 'Bullet Queen', category: 'Pistol', rarity: 'Covert', price: 750 },
  { weapon: 'Glock-18', name: 'Vogue', category: 'Pistol', rarity: 'Covert', price: 550 },

  // P250 skins
  { weapon: 'P250', name: 'Mehndi', category: 'Pistol', rarity: 'Covert', price: 1200 },
  { weapon: 'P250', name: 'Asiimov', category: 'Pistol', rarity: 'Covert', price: 850 },
  { weapon: 'P250', name: 'Muertos', category: 'Pistol', rarity: 'Classified', price: 280 },
  { weapon: 'P250', name: 'Cartel', category: 'Pistol', rarity: 'Classified', price: 180 },
  { weapon: 'P250', name: 'Wingshot', category: 'Pistol', rarity: 'Restricted', price: 95 },
  { weapon: 'P250', name: 'Supernova', category: 'Pistol', rarity: 'Classified', price: 220 },
  { weapon: 'P250', name: 'Undertow', category: 'Pistol', rarity: 'Classified', price: 650 },
  { weapon: 'P250', name: 'Franklin', category: 'Pistol', rarity: 'Restricted', price: 150 },
  { weapon: 'P250', name: 'Splash', category: 'Pistol', rarity: 'Restricted', price: 85 },
  { weapon: 'P250', name: 'Steel Disruption', category: 'Pistol', rarity: 'Restricted', price: 75 },
  { weapon: 'P250', name: 'Sand Dune', category: 'Pistol', rarity: 'Consumer', price: 12 },
  { weapon: 'P250', name: 'Bone Mask', category: 'Pistol', rarity: 'Industrial', price: 22 },
  { weapon: 'P250', name: 'Contaminant', category: 'Pistol', rarity: 'Industrial', price: 28 },
  { weapon: 'P250', name: 'Nevermore', category: 'Pistol', rarity: 'Covert', price: 550 },
  { weapon: 'P250', name: 'See Ya Later', category: 'Pistol', rarity: 'Covert', price: 480 },

  // Five-SeveN skins
  { weapon: 'Five-SeveN', name: 'Hyper Beast', category: 'Pistol', rarity: 'Covert', price: 1500 },
  { weapon: 'Five-SeveN', name: 'Monkey Business', category: 'Pistol', rarity: 'Covert', price: 850 },
  { weapon: 'Five-SeveN', name: 'Fowl Play', category: 'Pistol', rarity: 'Classified', price: 380 },
  { weapon: 'Five-SeveN', name: 'Retrobution', category: 'Pistol', rarity: 'Classified', price: 220 },
  { weapon: 'Five-SeveN', name: 'Case Hardened', category: 'Pistol', rarity: 'Classified', price: 420 },
  { weapon: 'Five-SeveN', name: 'Copper Galaxy', category: 'Pistol', rarity: 'Restricted', price: 95 },
  { weapon: 'Five-SeveN', name: 'Urban Hazard', category: 'Pistol', rarity: 'Industrial', price: 28 },
  { weapon: 'Five-SeveN', name: 'Forest Night', category: 'Pistol', rarity: 'Consumer', price: 15 },
  { weapon: 'Five-SeveN', name: 'Kami', category: 'Pistol', rarity: 'Mil-Spec', price: 55 },
  { weapon: 'Five-SeveN', name: 'Neon Kimono', category: 'Pistol', rarity: 'Covert', price: 650 },
  { weapon: 'Five-SeveN', name: 'Angry Mob', category: 'Pistol', rarity: 'Covert', price: 480 },
  { weapon: 'Five-SeveN', name: 'Fairy Tale', category: 'Pistol', rarity: 'Covert', price: 550 },

  // Tec-9 skins
  { weapon: 'Tec-9', name: 'Fuel Injector', category: 'Pistol', rarity: 'Covert', price: 950 },
  { weapon: 'Tec-9', name: 'Nuclear Threat', category: 'Pistol', rarity: 'Classified', price: 2200 },
  { weapon: 'Tec-9', name: 'Red Quartz', category: 'Pistol', rarity: 'Restricted', price: 180 },
  { weapon: 'Tec-9', name: 'Titanium Bit', category: 'Pistol', rarity: 'Restricted', price: 95 },
  { weapon: 'Tec-9', name: 'Avalanche', category: 'Pistol', rarity: 'Restricted', price: 120 },
  { weapon: 'Tec-9', name: 'Sandstorm', category: 'Pistol', rarity: 'Industrial', price: 35 },
  { weapon: 'Tec-9', name: 'VariCamo', category: 'Pistol', rarity: 'Industrial', price: 28 },
  { weapon: 'Tec-9', name: 'Urban DDPAT', category: 'Pistol', rarity: 'Industrial', price: 22 },
  { weapon: 'Tec-9', name: 'Decimator', category: 'Pistol', rarity: 'Covert', price: 420 },
  { weapon: 'Tec-9', name: 'Remote Control', category: 'Pistol', rarity: 'Covert', price: 380 },
  { weapon: 'Tec-9', name: 'Bamboozle', category: 'Pistol', rarity: 'Classified', price: 280 },

  // CZ75-Auto skins
  { weapon: 'CZ75-Auto', name: 'Victoria', category: 'Pistol', rarity: 'Covert', price: 1200 },
  { weapon: 'CZ75-Auto', name: 'Xiangliu', category: 'Pistol', rarity: 'Covert', price: 850 },
  { weapon: 'CZ75-Auto', name: 'Yellow Jacket', category: 'Pistol', rarity: 'Classified', price: 320 },
  { weapon: 'CZ75-Auto', name: 'Tigris', category: 'Pistol', rarity: 'Restricted', price: 95 },
  { weapon: 'CZ75-Auto', name: 'Crimson Web', category: 'Pistol', rarity: 'Classified', price: 280 },
  { weapon: 'CZ75-Auto', name: 'Poison Dart', category: 'Pistol', rarity: 'Restricted', price: 85 },
  { weapon: 'CZ75-Auto', name: 'Pole Position', category: 'Pistol', rarity: 'Restricted', price: 75 },
  { weapon: 'CZ75-Auto', name: 'Army Sheen', category: 'Pistol', rarity: 'Industrial', price: 22 },
  { weapon: 'CZ75-Auto', name: 'Emerald', category: 'Pistol', rarity: 'Restricted', price: 180 },
  { weapon: 'CZ75-Auto', name: 'Vendetta', category: 'Pistol', rarity: 'Covert', price: 550 },

  // Dual Berettas skins
  { weapon: 'Dual Berettas', name: 'Cobra Strike', category: 'Pistol', rarity: 'Covert', price: 850 },
  { weapon: 'Dual Berettas', name: 'Twin Turbo', category: 'Pistol', rarity: 'Covert', price: 650 },
  { weapon: 'Dual Berettas', name: 'Royal Consorts', category: 'Pistol', rarity: 'Covert', price: 550 },
  { weapon: 'Dual Berettas', name: 'Urban Shock', category: 'Pistol', rarity: 'Restricted', price: 95 },
  { weapon: 'Dual Berettas', name: 'Hemoglobin', category: 'Pistol', rarity: 'Restricted', price: 120 },
  { weapon: 'Dual Berettas', name: 'Marina', category: 'Pistol', rarity: 'Classified', price: 180 },
  { weapon: 'Dual Berettas', name: 'Moon in Libra', category: 'Pistol', rarity: 'Consumer', price: 15 },
  { weapon: 'Dual Berettas', name: 'Stained', category: 'Pistol', rarity: 'Industrial', price: 28 },
  { weapon: 'Dual Berettas', name: 'Pyre', category: 'Pistol', rarity: 'Restricted', price: 85 },
  { weapon: 'Dual Berettas', name: 'Melondrama', category: 'Pistol', rarity: 'Covert', price: 420 },

  // R8 Revolver skins
  { weapon: 'R8 Revolver', name: 'Fade', category: 'Pistol', rarity: 'Covert', price: 2200 },
  { weapon: 'R8 Revolver', name: 'Amber Fade', category: 'Pistol', rarity: 'Restricted', price: 280 },
  { weapon: 'R8 Revolver', name: 'Reboot', category: 'Pistol', rarity: 'Restricted', price: 95 },
  { weapon: 'R8 Revolver', name: 'Crimson Web', category: 'Pistol', rarity: 'Classified', price: 380 },
  { weapon: 'R8 Revolver', name: 'Llama Cannon', category: 'Pistol', rarity: 'Restricted', price: 120 },
  { weapon: 'R8 Revolver', name: 'Bone Mask', category: 'Pistol', rarity: 'Consumer', price: 18 },
  { weapon: 'R8 Revolver', name: 'Survivalist', category: 'Pistol', rarity: 'Industrial', price: 28 },
  { weapon: 'R8 Revolver', name: 'Canal Spray', category: 'Pistol', rarity: 'Industrial', price: 22 },
  { weapon: 'R8 Revolver', name: 'Crazy 8', category: 'Pistol', rarity: 'Classified', price: 220 },
  { weapon: 'R8 Revolver', name: 'Banana Cannon', category: 'Pistol', rarity: 'Covert', price: 450 },

  // Galil AR skins
  { weapon: 'Galil AR', name: 'Chatterbox', category: 'Rifle', rarity: 'Covert', price: 1500 },
  { weapon: 'Galil AR', name: 'Eco', category: 'Rifle', rarity: 'Classified', price: 320 },
  { weapon: 'Galil AR', name: 'Cerberus', category: 'Rifle', rarity: 'Covert', price: 850 },
  { weapon: 'Galil AR', name: 'Stone Cold', category: 'Rifle', rarity: 'Restricted', price: 95 },
  { weapon: 'Galil AR', name: 'Orange DDPAT', category: 'Rifle', rarity: 'Industrial', price: 28 },
  { weapon: 'Galil AR', name: 'Sage Spray', category: 'Rifle', rarity: 'Industrial', price: 22 },
  { weapon: 'Galil AR', name: 'Urban Rubble', category: 'Rifle', rarity: 'Consumer', price: 12 },
  { weapon: 'Galil AR', name: 'Rocket Pop', category: 'Rifle', rarity: 'Restricted', price: 120 },
  { weapon: 'Galil AR', name: 'Sugar Rush', category: 'Rifle', rarity: 'Classified', price: 220 },
  { weapon: 'Galil AR', name: 'Phoenix Blacklight', category: 'Rifle', rarity: 'Classified', price: 280 },
  { weapon: 'Galil AR', name: 'Signal', category: 'Rifle', rarity: 'Restricted', price: 85 },
  { weapon: 'Galil AR', name: 'Vandal', category: 'Rifle', rarity: 'Industrial', price: 35 },

  // FAMAS skins
  { weapon: 'FAMAS', name: 'Mecha Industries', category: 'Rifle', rarity: 'Covert', price: 1200 },
  { weapon: 'FAMAS', name: 'Roll Cage', category: 'Rifle', rarity: 'Classified', price: 220 },
  { weapon: 'FAMAS', name: 'Djinn', category: 'Rifle', rarity: 'Restricted', price: 95 },
  { weapon: 'FAMAS', name: 'Afterimage', category: 'Rifle', rarity: 'Classified', price: 380 },
  { weapon: 'FAMAS', name: 'Pulse', category: 'Rifle', rarity: 'Restricted', price: 120 },
  { weapon: 'FAMAS', name: 'Doomkitty', category: 'Rifle', rarity: 'Restricted', price: 85 },
  { weapon: 'FAMAS', name: 'Styx', category: 'Rifle', rarity: 'Restricted', price: 75 },
  { weapon: 'FAMAS', name: 'Colony', category: 'Rifle', rarity: 'Industrial', price: 28 },
  { weapon: 'FAMAS', name: 'Teardown', category: 'Rifle', rarity: 'Industrial', price: 22 },
  { weapon: 'FAMAS', name: 'Crypsis', category: 'Rifle', rarity: 'Restricted', price: 65 },
  { weapon: 'FAMAS', name: 'Eye of Athena', category: 'Rifle', rarity: 'Covert', price: 550 },
  { weapon: 'FAMAS', name: 'ZX Spectron', category: 'Rifle', rarity: 'Covert', price: 480 },

  // SG 553 skins
  { weapon: 'SG 553', name: 'Cyrex', category: 'Rifle', rarity: 'Covert', price: 850 },
  { weapon: 'SG 553', name: 'Integrale', category: 'Rifle', rarity: 'Covert', price: 650 },
  { weapon: 'SG 553', name: 'Tiger Moth', category: 'Rifle', rarity: 'Classified', price: 180 },
  { weapon: 'SG 553', name: 'Pulse', category: 'Rifle', rarity: 'Restricted', price: 95 },
  { weapon: 'SG 553', name: 'Triarch', category: 'Rifle', rarity: 'Restricted', price: 120 },
  { weapon: 'SG 553', name: 'Ultraviolet', category: 'Rifle', rarity: 'Classified', price: 280 },
  { weapon: 'SG 553', name: 'Phantom', category: 'Rifle', rarity: 'Classified', price: 220 },
  { weapon: 'SG 553', name: 'Wave Spray', category: 'Rifle', rarity: 'Consumer', price: 12 },
  { weapon: 'SG 553', name: 'Fallout Warning', category: 'Rifle', rarity: 'Industrial', price: 28 },
  { weapon: 'SG 553', name: 'Aerial', category: 'Rifle', rarity: 'Restricted', price: 85 },
  { weapon: 'SG 553', name: 'Darkwing', category: 'Rifle', rarity: 'Covert', price: 420 },

  // AUG skins
  { weapon: 'AUG', name: 'Akihabara Accept', category: 'Rifle', rarity: 'Covert', price: 15000 },
  { weapon: 'AUG', name: 'Chameleon', category: 'Rifle', rarity: 'Covert', price: 850 },
  { weapon: 'AUG', name: 'Hot Rod', category: 'Rifle', rarity: 'Classified', price: 3200 },
  { weapon: 'AUG', name: 'Bengal Tiger', category: 'Rifle', rarity: 'Classified', price: 320 },
  { weapon: 'AUG', name: 'Torque', category: 'Rifle', rarity: 'Restricted', price: 95 },
  { weapon: 'AUG', name: 'Wings', category: 'Rifle', rarity: 'Industrial', price: 28 },
  { weapon: 'AUG', name: 'Storm', category: 'Rifle', rarity: 'Consumer', price: 15 },
  { weapon: 'AUG', name: 'Condemned', category: 'Rifle', rarity: 'Industrial', price: 22 },
  { weapon: 'AUG', name: 'Stymphalian', category: 'Rifle', rarity: 'Classified', price: 220 },
  { weapon: 'AUG', name: 'Syd Mead', category: 'Rifle', rarity: 'Classified', price: 280 },
  { weapon: 'AUG', name: 'Fleet Flock', category: 'Rifle', rarity: 'Restricted', price: 120 },
  { weapon: 'AUG', name: 'Aristocrat', category: 'Rifle', rarity: 'Restricted', price: 85 },
  { weapon: 'AUG', name: 'Death by Puppy', category: 'Rifle', rarity: 'Covert', price: 550 },
  { weapon: 'AUG', name: 'Flame Jörmungandr', category: 'Rifle', rarity: 'Covert', price: 650 },

  // SSG 08 skins
  { weapon: 'SSG 08', name: 'Blood in the Water', category: 'Sniper', rarity: 'Covert', price: 4500 },
  { weapon: 'SSG 08', name: 'Dragonfire', category: 'Sniper', rarity: 'Covert', price: 1800 },
  { weapon: 'SSG 08', name: 'Big Iron', category: 'Sniper', rarity: 'Classified', price: 380 },
  { weapon: 'SSG 08', name: 'Detour', category: 'Sniper', rarity: 'Restricted', price: 180 },
  { weapon: 'SSG 08', name: 'Abyss', category: 'Sniper', rarity: 'Restricted', price: 120 },
  { weapon: 'SSG 08', name: 'Dark Water', category: 'Sniper', rarity: 'Restricted', price: 220 },
  { weapon: 'SSG 08', name: 'Slashed', category: 'Sniper', rarity: 'Restricted', price: 95 },
  { weapon: 'SSG 08', name: 'Tropical Storm', category: 'Sniper', rarity: 'Industrial', price: 28 },
  { weapon: 'SSG 08', name: 'Sand Dune', category: 'Sniper', rarity: 'Consumer', price: 12 },
  { weapon: 'SSG 08', name: 'Ghost Crusader', category: 'Sniper', rarity: 'Classified', price: 280 },
  { weapon: 'SSG 08', name: 'Fever Dream', category: 'Sniper', rarity: 'Covert', price: 650 },
  { weapon: 'SSG 08', name: 'Turbo Peek', category: 'Sniper', rarity: 'Covert', price: 550 },
  { weapon: 'SSG 08', name: 'Sea Calico', category: 'Sniper', rarity: 'Covert', price: 480 },

  // SCAR-20 skins
  { weapon: 'SCAR-20', name: 'Emerald', category: 'Sniper', rarity: 'Covert', price: 1200 },
  { weapon: 'SCAR-20', name: 'Bloodsport', category: 'Sniper', rarity: 'Covert', price: 850 },
  { weapon: 'SCAR-20', name: 'Cardiac', category: 'Sniper', rarity: 'Classified', price: 320 },
  { weapon: 'SCAR-20', name: 'Cyrex', category: 'Sniper', rarity: 'Classified', price: 180 },
  { weapon: 'SCAR-20', name: 'Jungle Slipstream', category: 'Sniper', rarity: 'Restricted', price: 95 },
  { weapon: 'SCAR-20', name: 'Carbon Fiber', category: 'Sniper', rarity: 'Industrial', price: 28 },
  { weapon: 'SCAR-20', name: 'Palm', category: 'Sniper', rarity: 'Consumer', price: 12 },
  { weapon: 'SCAR-20', name: 'Storm', category: 'Sniper', rarity: 'Consumer', price: 15 },
  { weapon: 'SCAR-20', name: 'Blueprint', category: 'Sniper', rarity: 'Restricted', price: 85 },
  { weapon: 'SCAR-20', name: 'Enforcer', category: 'Sniper', rarity: 'Covert', price: 550 },
  { weapon: 'SCAR-20', name: 'Fragments', category: 'Sniper', rarity: 'Covert', price: 480 },

  // G3SG1 skins
  { weapon: 'G3SG1', name: 'The Executioner', category: 'Sniper', rarity: 'Covert', price: 1500 },
  { weapon: 'G3SG1', name: 'Flux', category: 'Sniper', rarity: 'Classified', price: 280 },
  { weapon: 'G3SG1', name: 'High Seas', category: 'Sniper', rarity: 'Covert', price: 650 },
  { weapon: 'G3SG1', name: 'Stinger', category: 'Sniper', rarity: 'Restricted', price: 95 },
  { weapon: 'G3SG1', name: 'Orange Crash', category: 'Sniper', rarity: 'Restricted', price: 120 },
  { weapon: 'G3SG1', name: 'VariCamo', category: 'Sniper', rarity: 'Industrial', price: 22 },
  { weapon: 'G3SG1', name: 'Safari Mesh', category: 'Sniper', rarity: 'Industrial', price: 18 },
  { weapon: 'G3SG1', name: 'Jungle Dashed', category: 'Sniper', rarity: 'Consumer', price: 12 },
  { weapon: 'G3SG1', name: 'Digital Mesh', category: 'Sniper', rarity: 'Restricted', price: 85 },
  { weapon: 'G3SG1', name: 'Ventilator', category: 'Sniper', rarity: 'Classified', price: 220 },
  { weapon: 'G3SG1', name: 'Scavenger', category: 'Sniper', rarity: 'Covert', price: 550 },

  // MAC-10 skins
  { weapon: 'MAC-10', name: 'Neon Rider', category: 'SMG', rarity: 'Covert', price: 1500 },
  { weapon: 'MAC-10', name: 'Propaganda', category: 'SMG', rarity: 'Covert', price: 850 },
  { weapon: 'MAC-10', name: 'Disco Tech', category: 'SMG', rarity: 'Classified', price: 380 },
  { weapon: 'MAC-10', name: 'Heat', category: 'SMG', rarity: 'Restricted', price: 120 },
  { weapon: 'MAC-10', name: 'Fade', category: 'SMG', rarity: 'Restricted', price: 650 },
  { weapon: 'MAC-10', name: 'Tatter', category: 'SMG', rarity: 'Restricted', price: 95 },
  { weapon: 'MAC-10', name: 'Amber Fade', category: 'SMG', rarity: 'Restricted', price: 280 },
  { weapon: 'MAC-10', name: 'Silver', category: 'SMG', rarity: 'Industrial', price: 28 },
  { weapon: 'MAC-10', name: 'Urban DDPAT', category: 'SMG', rarity: 'Industrial', price: 22 },
  { weapon: 'MAC-10', name: 'Candy Apple', category: 'SMG', rarity: 'Industrial', price: 35 },
  { weapon: 'MAC-10', name: 'Stalker', category: 'SMG', rarity: 'Covert', price: 480 },
  { weapon: 'MAC-10', name: 'Gold Brick', category: 'SMG', rarity: 'Covert', price: 420 },

  // MP9 skins
  { weapon: 'MP9', name: 'Bulldozer', category: 'SMG', rarity: 'Covert', price: 1200 },
  { weapon: 'MP9', name: 'Airlock', category: 'SMG', rarity: 'Covert', price: 650 },
  { weapon: 'MP9', name: 'Hypnotic', category: 'SMG', rarity: 'Restricted', price: 280 },
  { weapon: 'MP9', name: 'Rose Iron', category: 'SMG', rarity: 'Restricted', price: 120 },
  { weapon: 'MP9', name: 'Dart', category: 'SMG', rarity: 'Industrial', price: 28 },
  { weapon: 'MP9', name: 'Sand Dashed', category: 'SMG', rarity: 'Consumer', price: 12 },
  { weapon: 'MP9', name: 'Storm', category: 'SMG', rarity: 'Consumer', price: 15 },
  { weapon: 'MP9', name: 'Hot Rod', category: 'SMG', rarity: 'Classified', price: 950 },
  { weapon: 'MP9', name: 'Ruby Poison Dart', category: 'SMG', rarity: 'Classified', price: 320 },
  { weapon: 'MP9', name: 'Starlight Protector', category: 'SMG', rarity: 'Covert', price: 480 },
  { weapon: 'MP9', name: 'Mount Fuji', category: 'SMG', rarity: 'Covert', price: 550 },

  // MP7 skins
  { weapon: 'MP7', name: 'Nemesis', category: 'SMG', rarity: 'Covert', price: 850 },
  { weapon: 'MP7', name: 'Bloodsport', category: 'SMG', rarity: 'Covert', price: 650 },
  { weapon: 'MP7', name: 'Powercore', category: 'SMG', rarity: 'Classified', price: 220 },
  { weapon: 'MP7', name: 'Impire', category: 'SMG', rarity: 'Classified', price: 180 },
  { weapon: 'MP7', name: 'Special Delivery', category: 'SMG', rarity: 'Classified', price: 280 },
  { weapon: 'MP7', name: 'Skulls', category: 'SMG', rarity: 'Restricted', price: 95 },
  { weapon: 'MP7', name: 'Anodized Navy', category: 'SMG', rarity: 'Mil-Spec', price: 55 },
  { weapon: 'MP7', name: 'Whiteout', category: 'SMG', rarity: 'Restricted', price: 320 },
  { weapon: 'MP7', name: 'Forest DDPAT', category: 'SMG', rarity: 'Consumer', price: 12 },
  { weapon: 'MP7', name: 'Scorched', category: 'SMG', rarity: 'Consumer', price: 15 },
  { weapon: 'MP7', name: 'Guerrilla', category: 'SMG', rarity: 'Covert', price: 480 },
  { weapon: 'MP7', name: 'Neon Ply', category: 'SMG', rarity: 'Covert', price: 420 },

  // UMP-45 skins
  { weapon: 'UMP-45', name: 'Primal Saber', category: 'SMG', rarity: 'Covert', price: 950 },
  { weapon: 'UMP-45', name: 'Blaze', category: 'SMG', rarity: 'Restricted', price: 1800 },
  { weapon: 'UMP-45', name: 'Momentum', category: 'SMG', rarity: 'Covert', price: 650 },
  { weapon: 'UMP-45', name: 'Scaffold', category: 'SMG', rarity: 'Restricted', price: 95 },
  { weapon: 'UMP-45', name: 'Corporal', category: 'SMG', rarity: 'Restricted', price: 120 },
  { weapon: 'UMP-45', name: 'Carbon Fiber', category: 'SMG', rarity: 'Industrial', price: 28 },
  { weapon: 'UMP-45', name: 'Urban DDPAT', category: 'SMG', rarity: 'Industrial', price: 22 },
  { weapon: 'UMP-45', name: 'Mudder', category: 'SMG', rarity: 'Consumer', price: 12 },
  { weapon: 'UMP-45', name: 'Grand Prix', category: 'SMG', rarity: 'Classified', price: 220 },
  { weapon: 'UMP-45', name: 'Metal Flowers', category: 'SMG', rarity: 'Restricted', price: 85 },
  { weapon: 'UMP-45', name: 'Roadblock', category: 'SMG', rarity: 'Covert', price: 480 },
  { weapon: 'UMP-45', name: 'Crime Scene', category: 'SMG', rarity: 'Covert', price: 420 },

  // P90 skins
  { weapon: 'P90', name: 'Death by Kitty', category: 'SMG', rarity: 'Covert', price: 4500 },
  { weapon: 'P90', name: 'Asiimov', category: 'SMG', rarity: 'Covert', price: 1500 },
  { weapon: 'P90', name: 'Nostalgia', category: 'SMG', rarity: 'Covert', price: 850 },
  { weapon: 'P90', name: 'Cold Blooded', category: 'SMG', rarity: 'Classified', price: 280 },
  { weapon: 'P90', name: 'Trigon', category: 'SMG', rarity: 'Classified', price: 220 },
  { weapon: 'P90', name: 'Elite Build', category: 'SMG', rarity: 'Restricted', price: 95 },
  { weapon: 'P90', name: 'Blind Spot', category: 'SMG', rarity: 'Restricted', price: 120 },
  { weapon: 'P90', name: 'Scorched', category: 'SMG', rarity: 'Consumer', price: 15 },
  { weapon: 'P90', name: 'Sand Spray', category: 'SMG', rarity: 'Consumer', price: 12 },
  { weapon: 'P90', name: 'Storm', category: 'SMG', rarity: 'Consumer', price: 18 },
  { weapon: 'P90', name: 'Desert Warfare', category: 'SMG', rarity: 'Covert', price: 550 },
  { weapon: 'P90', name: 'Facility Negative', category: 'SMG', rarity: 'Covert', price: 480 },
  { weapon: 'P90', name: 'Shapewood', category: 'SMG', rarity: 'Covert', price: 420 },

  // PP-Bizon skins
  { weapon: 'PP-Bizon', name: 'Judgement of Anubis', category: 'SMG', rarity: 'Covert', price: 550 },
  { weapon: 'PP-Bizon', name: 'Fuel Rod', category: 'SMG', rarity: 'Classified', price: 180 },
  { weapon: 'PP-Bizon', name: 'Antique', category: 'SMG', rarity: 'Restricted', price: 120 },
  { weapon: 'PP-Bizon', name: 'Blue Streak', category: 'SMG', rarity: 'Restricted', price: 95 },
  { weapon: 'PP-Bizon', name: 'Cobalt Halftone', category: 'SMG', rarity: 'Industrial', price: 28 },
  { weapon: 'PP-Bizon', name: 'Sand Dashed', category: 'SMG', rarity: 'Consumer', price: 12 },
  { weapon: 'PP-Bizon', name: 'Urban Dashed', category: 'SMG', rarity: 'Consumer', price: 15 },
  { weapon: 'PP-Bizon', name: 'Water Sigil', category: 'SMG', rarity: 'Restricted', price: 85 },
  { weapon: 'PP-Bizon', name: 'High Roller', category: 'SMG', rarity: 'Classified', price: 220 },
  { weapon: 'PP-Bizon', name: 'Space Cat', category: 'SMG', rarity: 'Covert', price: 420 },

  // Nova skins
  { weapon: 'Nova', name: 'Antique', category: 'Shotgun', rarity: 'Covert', price: 850 },
  { weapon: 'Nova', name: 'Hyper Beast', category: 'Shotgun', rarity: 'Covert', price: 650 },
  { weapon: 'Nova', name: 'Tempest', category: 'Shotgun', rarity: 'Classified', price: 180 },
  { weapon: 'Nova', name: 'Bloomstick', category: 'Shotgun', rarity: 'Classified', price: 220 },
  { weapon: 'Nova', name: 'Rising Skull', category: 'Shotgun', rarity: 'Restricted', price: 95 },
  { weapon: 'Nova', name: 'Koi', category: 'Shotgun', rarity: 'Restricted', price: 120 },
  { weapon: 'Nova', name: 'Sand Dune', category: 'Shotgun', rarity: 'Consumer', price: 12 },
  { weapon: 'Nova', name: 'Predator', category: 'Shotgun', rarity: 'Industrial', price: 28 },
  { weapon: 'Nova', name: 'Modern Hunter', category: 'Shotgun', rarity: 'Industrial', price: 22 },
  { weapon: 'Nova', name: 'Plume', category: 'Shotgun', rarity: 'Covert', price: 480 },
  { weapon: 'Nova', name: 'Gila', category: 'Shotgun', rarity: 'Covert', price: 420 },

  // XM1014 skins
  { weapon: 'XM1014', name: 'Tranquility', category: 'Shotgun', rarity: 'Covert', price: 650 },
  { weapon: 'XM1014', name: 'Ziggy', category: 'Shotgun', rarity: 'Classified', price: 220 },
  { weapon: 'XM1014', name: 'Slipstream', category: 'Shotgun', rarity: 'Restricted', price: 95 },
  { weapon: 'XM1014', name: 'Heaven Guard', category: 'Shotgun', rarity: 'Restricted', price: 120 },
  { weapon: 'XM1014', name: 'Bone Machine', category: 'Shotgun', rarity: 'Mil-Spec', price: 55 },
  { weapon: 'XM1014', name: 'Blue Spruce', category: 'Shotgun', rarity: 'Consumer', price: 12 },
  { weapon: 'XM1014', name: 'Urban Perforated', category: 'Shotgun', rarity: 'Consumer', price: 15 },
  { weapon: 'XM1014', name: 'Seasons', category: 'Shotgun', rarity: 'Classified', price: 280 },
  { weapon: 'XM1014', name: 'Incinegator', category: 'Shotgun', rarity: 'Covert', price: 550 },
  { weapon: 'XM1014', name: 'Entombed', category: 'Shotgun', rarity: 'Covert', price: 480 },

  // MAG-7 skins
  { weapon: 'MAG-7', name: 'Bulldozer', category: 'Shotgun', rarity: 'Covert', price: 650 },
  { weapon: 'MAG-7', name: 'Heat', category: 'Shotgun', rarity: 'Classified', price: 280 },
  { weapon: 'MAG-7', name: 'Praetorian', category: 'Shotgun', rarity: 'Covert', price: 850 },
  { weapon: 'MAG-7', name: 'Memento', category: 'Shotgun', rarity: 'Restricted', price: 95 },
  { weapon: 'MAG-7', name: 'Firestarter', category: 'Shotgun', rarity: 'Restricted', price: 120 },
  { weapon: 'MAG-7', name: 'Sand Dune', category: 'Shotgun', rarity: 'Consumer', price: 12 },
  { weapon: 'MAG-7', name: 'Storm', category: 'Shotgun', rarity: 'Consumer', price: 15 },
  { weapon: 'MAG-7', name: 'Metallic DDPAT', category: 'Shotgun', rarity: 'Industrial', price: 22 },
  { weapon: 'MAG-7', name: 'Justice', category: 'Shotgun', rarity: 'Covert', price: 480 },
  { weapon: 'MAG-7', name: 'Monster Call', category: 'Shotgun', rarity: 'Covert', price: 420 },

  // Sawed-Off skins
  { weapon: 'Sawed-Off', name: 'The Kraken', category: 'Shotgun', rarity: 'Covert', price: 850 },
  { weapon: 'Sawed-Off', name: 'Devourer', category: 'Shotgun', rarity: 'Covert', price: 650 },
  { weapon: 'Sawed-Off', name: 'Highwayman', category: 'Shotgun', rarity: 'Classified', price: 180 },
  { weapon: 'Sawed-Off', name: 'Limelight', category: 'Shotgun', rarity: 'Classified', price: 220 },
  { weapon: 'Sawed-Off', name: 'Serenity', category: 'Shotgun', rarity: 'Restricted', price: 95 },
  { weapon: 'Sawed-Off', name: 'Amber Fade', category: 'Shotgun', rarity: 'Restricted', price: 120 },
  { weapon: 'Sawed-Off', name: 'Snake Camo', category: 'Shotgun', rarity: 'Consumer', price: 12 },
  { weapon: 'Sawed-Off', name: 'Sage Spray', category: 'Shotgun', rarity: 'Consumer', price: 15 },
  { weapon: 'Sawed-Off', name: 'Rust Coat', category: 'Shotgun', rarity: 'Industrial', price: 28 },
  { weapon: 'Sawed-Off', name: 'Black Sand', category: 'Shotgun', rarity: 'Covert', price: 480 },
  { weapon: 'Sawed-Off', name: 'Apocalypto', category: 'Shotgun', rarity: 'Covert', price: 420 },

  // M249 skins
  { weapon: 'M249', name: 'Magma', category: 'Heavy', rarity: 'Restricted', price: 180 },
  { weapon: 'M249', name: 'Nebula Crusader', category: 'Heavy', rarity: 'Covert', price: 650 },
  { weapon: 'M249', name: 'System Lock', category: 'Heavy', rarity: 'Classified', price: 280 },
  { weapon: 'M249', name: 'Spectre', category: 'Heavy', rarity: 'Restricted', price: 95 },
  { weapon: 'M249', name: 'Jungle DDPAT', category: 'Heavy', rarity: 'Industrial', price: 22 },
  { weapon: 'M249', name: 'Contrast Spray', category: 'Heavy', rarity: 'Consumer', price: 12 },
  { weapon: 'M249', name: 'Gator Mesh', category: 'Heavy', rarity: 'Industrial', price: 28 },
  { weapon: 'M249', name: 'Impact Drill', category: 'Heavy', rarity: 'Restricted', price: 120 },
  { weapon: 'M249', name: 'Downtown', category: 'Heavy', rarity: 'Covert', price: 480 },
  { weapon: 'M249', name: 'Deep Relief', category: 'Heavy', rarity: 'Covert', price: 420 },

  // Negev skins
  { weapon: 'Negev', name: 'Power Loader', category: 'Heavy', rarity: 'Covert', price: 850 },
  { weapon: 'Negev', name: 'Loudmouth', category: 'Heavy', rarity: 'Classified', price: 280 },
  { weapon: 'Negev', name: 'Mjölnir', category: 'Heavy', rarity: 'Covert', price: 1200 },
  { weapon: 'Negev', name: 'Bratatat', category: 'Heavy', rarity: 'Restricted', price: 95 },
  { weapon: 'Negev', name: 'Terrain', category: 'Heavy', rarity: 'Consumer', price: 12 },
  { weapon: 'Negev', name: 'Army Sheen', category: 'Heavy', rarity: 'Industrial', price: 22 },
  { weapon: 'Negev', name: 'Palm', category: 'Heavy', rarity: 'Consumer', price: 15 },
  { weapon: 'Negev', name: 'Prototype', category: 'Heavy', rarity: 'Covert', price: 480 },
  { weapon: 'Negev', name: 'Ultralight', category: 'Heavy', rarity: 'Covert', price: 550 },
  { weapon: 'Negev', name: 'Drop Me', category: 'Heavy', rarity: 'Covert', price: 420 },
]

function generateImageUrl(weapon: string, skin: string): string {
  // Format: https://www.csgodatabase.com/images/skins/webp/WEAPON_SKIN.webp
  const weaponFormatted = weapon.toLowerCase().replace(/-/g, '').replace(/ /g, '-')
  const skinFormatted = skin.toLowerCase().replace(/'/g, '').replace(/ /g, '-')
  return `https://www.csgodatabase.com/images/skins/webp/${weaponFormatted}_${skinFormatted}.webp`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get current count
    const { count: currentCount } = await supabase
      .from('skins')
      .select('*', { count: 'exact', head: true })

    console.log(`Current skins count: ${currentCount}`)

    let added = 0
    let failed = 0
    const failedSkins: string[] = []

    for (const skin of ADDITIONAL_SKINS) {
      // Check if skin already exists
      const { data: existing } = await supabase
        .from('skins')
        .select('id')
        .eq('weapon', skin.weapon)
        .eq('name', skin.name)
        .single()

      if (existing) {
        continue // Skip existing skins
      }

      const imageUrl = generateImageUrl(skin.weapon, skin.name)

      // Verify image exists
      try {
        const response = await fetch(imageUrl, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })

        if (!response.ok) {
          console.log(`Invalid image URL for ${skin.weapon} ${skin.name}: ${response.status}`)
          failedSkins.push(`${skin.weapon} ${skin.name}`)
          failed++
          continue
        }
      } catch (e) {
        console.log(`Failed to verify image for ${skin.weapon} ${skin.name}`)
        failedSkins.push(`${skin.weapon} ${skin.name}`)
        failed++
        continue
      }

      // Insert skin
      const { error } = await supabase
        .from('skins')
        .insert({
          weapon: skin.weapon,
          name: skin.name,
          category: skin.category,
          rarity: skin.rarity,
          price: skin.price,
          image_url: imageUrl
        })

      if (error) {
        console.log(`Failed to insert ${skin.weapon} ${skin.name}: ${error.message}`)
        failed++
      } else {
        added++
        console.log(`Added: ${skin.weapon} ${skin.name}`)
      }

      // Small delay
      await new Promise(r => setTimeout(r, 30))
    }

    // Get new count
    const { count: newCount } = await supabase
      .from('skins')
      .select('*', { count: 'exact', head: true })

    return new Response(JSON.stringify({
      success: true,
      previousCount: currentCount,
      newCount: newCount,
      added: added,
      failed: failed,
      failedSkins: failedSkins.slice(0, 50) // Show first 50 failed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
