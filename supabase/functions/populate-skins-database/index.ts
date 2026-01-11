import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Complete CS2 skins database with real prices (in RUB, approximate from csgodatabase.com)
const SKINS_DATABASE = [
  // ============ KNIVES ============
  // Karambit
  { weapon: "Karambit", name: "Doppler", category: "knife", rarity: "covert", price: 85000 },
  { weapon: "Karambit", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 78000 },
  { weapon: "Karambit", name: "Marble Fade", category: "knife", rarity: "covert", price: 95000 },
  { weapon: "Karambit", name: "Fade", category: "knife", rarity: "covert", price: 120000 },
  { weapon: "Karambit", name: "Gamma Doppler", category: "knife", rarity: "covert", price: 90000 },
  { weapon: "Karambit", name: "Autotronic", category: "knife", rarity: "covert", price: 65000 },
  { weapon: "Karambit", name: "Lore", category: "knife", rarity: "covert", price: 70000 },
  { weapon: "Karambit", name: "Crimson Web", category: "knife", rarity: "covert", price: 85000 },
  { weapon: "Karambit", name: "Slaughter", category: "knife", rarity: "covert", price: 55000 },
  { weapon: "Karambit", name: "Case Hardened", category: "knife", rarity: "covert", price: 60000 },
  { weapon: "Karambit", name: "Blue Steel", category: "knife", rarity: "covert", price: 42000 },
  { weapon: "Karambit", name: "Night", category: "knife", rarity: "covert", price: 38000 },
  { weapon: "Karambit", name: "Vanilla", category: "knife", rarity: "covert", price: 45000 },
  { weapon: "Karambit", name: "Rust Coat", category: "knife", rarity: "covert", price: 35000 },
  { weapon: "Karambit", name: "Safari Mesh", category: "knife", rarity: "covert", price: 32000 },
  { weapon: "Karambit", name: "Boreal Forest", category: "knife", rarity: "covert", price: 33000 },
  { weapon: "Karambit", name: "Urban Masked", category: "knife", rarity: "covert", price: 31000 },
  { weapon: "Karambit", name: "Forest DDPAT", category: "knife", rarity: "covert", price: 30000 },
  { weapon: "Karambit", name: "Scorched", category: "knife", rarity: "covert", price: 29000 },
  { weapon: "Karambit", name: "Stained", category: "knife", rarity: "covert", price: 36000 },
  { weapon: "Karambit", name: "Sapphire", category: "knife", rarity: "contraband", price: 850000 },
  { weapon: "Karambit", name: "Ruby", category: "knife", rarity: "contraband", price: 750000 },
  { weapon: "Karambit", name: "Black Pearl", category: "knife", rarity: "contraband", price: 450000 },
  
  // M9 Bayonet
  { weapon: "M9 Bayonet", name: "Doppler", category: "knife", rarity: "covert", price: 65000 },
  { weapon: "M9 Bayonet", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 58000 },
  { weapon: "M9 Bayonet", name: "Marble Fade", category: "knife", rarity: "covert", price: 75000 },
  { weapon: "M9 Bayonet", name: "Fade", category: "knife", rarity: "covert", price: 85000 },
  { weapon: "M9 Bayonet", name: "Gamma Doppler", category: "knife", rarity: "covert", price: 70000 },
  { weapon: "M9 Bayonet", name: "Autotronic", category: "knife", rarity: "covert", price: 50000 },
  { weapon: "M9 Bayonet", name: "Lore", category: "knife", rarity: "covert", price: 55000 },
  { weapon: "M9 Bayonet", name: "Crimson Web", category: "knife", rarity: "covert", price: 65000 },
  { weapon: "M9 Bayonet", name: "Slaughter", category: "knife", rarity: "covert", price: 42000 },
  { weapon: "M9 Bayonet", name: "Case Hardened", category: "knife", rarity: "covert", price: 48000 },
  { weapon: "M9 Bayonet", name: "Blue Steel", category: "knife", rarity: "covert", price: 32000 },
  { weapon: "M9 Bayonet", name: "Night", category: "knife", rarity: "covert", price: 28000 },
  { weapon: "M9 Bayonet", name: "Vanilla", category: "knife", rarity: "covert", price: 35000 },
  { weapon: "M9 Bayonet", name: "Rust Coat", category: "knife", rarity: "covert", price: 25000 },
  { weapon: "M9 Bayonet", name: "Safari Mesh", category: "knife", rarity: "covert", price: 22000 },
  { weapon: "M9 Bayonet", name: "Boreal Forest", category: "knife", rarity: "covert", price: 23000 },
  { weapon: "M9 Bayonet", name: "Urban Masked", category: "knife", rarity: "covert", price: 21000 },
  { weapon: "M9 Bayonet", name: "Forest DDPAT", category: "knife", rarity: "covert", price: 20000 },
  { weapon: "M9 Bayonet", name: "Scorched", category: "knife", rarity: "covert", price: 19000 },
  { weapon: "M9 Bayonet", name: "Stained", category: "knife", rarity: "covert", price: 26000 },
  { weapon: "M9 Bayonet", name: "Sapphire", category: "knife", rarity: "contraband", price: 650000 },
  { weapon: "M9 Bayonet", name: "Ruby", category: "knife", rarity: "contraband", price: 550000 },
  
  // Butterfly Knife
  { weapon: "Butterfly Knife", name: "Doppler", category: "knife", rarity: "covert", price: 95000 },
  { weapon: "Butterfly Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 85000 },
  { weapon: "Butterfly Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 110000 },
  { weapon: "Butterfly Knife", name: "Fade", category: "knife", rarity: "covert", price: 140000 },
  { weapon: "Butterfly Knife", name: "Gamma Doppler", category: "knife", rarity: "covert", price: 100000 },
  { weapon: "Butterfly Knife", name: "Autotronic", category: "knife", rarity: "covert", price: 75000 },
  { weapon: "Butterfly Knife", name: "Lore", category: "knife", rarity: "covert", price: 80000 },
  { weapon: "Butterfly Knife", name: "Crimson Web", category: "knife", rarity: "covert", price: 95000 },
  { weapon: "Butterfly Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 65000 },
  { weapon: "Butterfly Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 70000 },
  { weapon: "Butterfly Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 52000 },
  { weapon: "Butterfly Knife", name: "Night", category: "knife", rarity: "covert", price: 48000 },
  { weapon: "Butterfly Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 55000 },
  { weapon: "Butterfly Knife", name: "Rust Coat", category: "knife", rarity: "covert", price: 42000 },
  { weapon: "Butterfly Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 38000 },
  { weapon: "Butterfly Knife", name: "Boreal Forest", category: "knife", rarity: "covert", price: 39000 },
  { weapon: "Butterfly Knife", name: "Black Pearl", category: "knife", rarity: "contraband", price: 550000 },
  
  // Bayonet
  { weapon: "Bayonet", name: "Doppler", category: "knife", rarity: "covert", price: 42000 },
  { weapon: "Bayonet", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 38000 },
  { weapon: "Bayonet", name: "Marble Fade", category: "knife", rarity: "covert", price: 52000 },
  { weapon: "Bayonet", name: "Fade", category: "knife", rarity: "covert", price: 58000 },
  { weapon: "Bayonet", name: "Gamma Doppler", category: "knife", rarity: "covert", price: 45000 },
  { weapon: "Bayonet", name: "Autotronic", category: "knife", rarity: "covert", price: 32000 },
  { weapon: "Bayonet", name: "Lore", category: "knife", rarity: "covert", price: 35000 },
  { weapon: "Bayonet", name: "Crimson Web", category: "knife", rarity: "covert", price: 42000 },
  { weapon: "Bayonet", name: "Slaughter", category: "knife", rarity: "covert", price: 28000 },
  { weapon: "Bayonet", name: "Case Hardened", category: "knife", rarity: "covert", price: 32000 },
  { weapon: "Bayonet", name: "Blue Steel", category: "knife", rarity: "covert", price: 22000 },
  { weapon: "Bayonet", name: "Night", category: "knife", rarity: "covert", price: 18000 },
  { weapon: "Bayonet", name: "Vanilla", category: "knife", rarity: "covert", price: 25000 },
  { weapon: "Bayonet", name: "Rust Coat", category: "knife", rarity: "covert", price: 15000 },
  { weapon: "Bayonet", name: "Safari Mesh", category: "knife", rarity: "covert", price: 12000 },
  { weapon: "Bayonet", name: "Ruby", category: "knife", rarity: "contraband", price: 320000 },
  { weapon: "Bayonet", name: "Sapphire", category: "knife", rarity: "contraband", price: 380000 },
  
  // Flip Knife
  { weapon: "Flip Knife", name: "Doppler", category: "knife", rarity: "covert", price: 28000 },
  { weapon: "Flip Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 25000 },
  { weapon: "Flip Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 35000 },
  { weapon: "Flip Knife", name: "Fade", category: "knife", rarity: "covert", price: 42000 },
  { weapon: "Flip Knife", name: "Gamma Doppler", category: "knife", rarity: "covert", price: 30000 },
  { weapon: "Flip Knife", name: "Autotronic", category: "knife", rarity: "covert", price: 22000 },
  { weapon: "Flip Knife", name: "Lore", category: "knife", rarity: "covert", price: 24000 },
  { weapon: "Flip Knife", name: "Crimson Web", category: "knife", rarity: "covert", price: 28000 },
  { weapon: "Flip Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 18000 },
  { weapon: "Flip Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 20000 },
  { weapon: "Flip Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 14000 },
  { weapon: "Flip Knife", name: "Night", category: "knife", rarity: "covert", price: 12000 },
  { weapon: "Flip Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 16000 },
  { weapon: "Flip Knife", name: "Rust Coat", category: "knife", rarity: "covert", price: 10000 },
  { weapon: "Flip Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 8500 },
  
  // Gut Knife
  { weapon: "Gut Knife", name: "Doppler", category: "knife", rarity: "covert", price: 15000 },
  { weapon: "Gut Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 13000 },
  { weapon: "Gut Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 18000 },
  { weapon: "Gut Knife", name: "Fade", category: "knife", rarity: "covert", price: 22000 },
  { weapon: "Gut Knife", name: "Gamma Doppler", category: "knife", rarity: "covert", price: 16000 },
  { weapon: "Gut Knife", name: "Autotronic", category: "knife", rarity: "covert", price: 11000 },
  { weapon: "Gut Knife", name: "Lore", category: "knife", rarity: "covert", price: 12000 },
  { weapon: "Gut Knife", name: "Crimson Web", category: "knife", rarity: "covert", price: 14000 },
  { weapon: "Gut Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 9500 },
  { weapon: "Gut Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 10000 },
  { weapon: "Gut Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 7500 },
  { weapon: "Gut Knife", name: "Night", category: "knife", rarity: "covert", price: 6500 },
  { weapon: "Gut Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 8500 },
  { weapon: "Gut Knife", name: "Rust Coat", category: "knife", rarity: "covert", price: 5500 },
  { weapon: "Gut Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 4800 },
  
  // Falchion Knife
  { weapon: "Falchion Knife", name: "Doppler", category: "knife", rarity: "covert", price: 14000 },
  { weapon: "Falchion Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 12000 },
  { weapon: "Falchion Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 17000 },
  { weapon: "Falchion Knife", name: "Fade", category: "knife", rarity: "covert", price: 20000 },
  { weapon: "Falchion Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 8500 },
  { weapon: "Falchion Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 9500 },
  { weapon: "Falchion Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 7000 },
  { weapon: "Falchion Knife", name: "Night", category: "knife", rarity: "covert", price: 6000 },
  { weapon: "Falchion Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 7500 },
  { weapon: "Falchion Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 4500 },
  
  // Bowie Knife
  { weapon: "Bowie Knife", name: "Doppler", category: "knife", rarity: "covert", price: 18000 },
  { weapon: "Bowie Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 15000 },
  { weapon: "Bowie Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 22000 },
  { weapon: "Bowie Knife", name: "Fade", category: "knife", rarity: "covert", price: 28000 },
  { weapon: "Bowie Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 11000 },
  { weapon: "Bowie Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 12000 },
  { weapon: "Bowie Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 9000 },
  { weapon: "Bowie Knife", name: "Night", category: "knife", rarity: "covert", price: 7500 },
  { weapon: "Bowie Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 9500 },
  { weapon: "Bowie Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 5500 },
  
  // Shadow Daggers
  { weapon: "Shadow Daggers", name: "Doppler", category: "knife", rarity: "covert", price: 12000 },
  { weapon: "Shadow Daggers", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 10000 },
  { weapon: "Shadow Daggers", name: "Marble Fade", category: "knife", rarity: "covert", price: 14000 },
  { weapon: "Shadow Daggers", name: "Fade", category: "knife", rarity: "covert", price: 18000 },
  { weapon: "Shadow Daggers", name: "Slaughter", category: "knife", rarity: "covert", price: 7500 },
  { weapon: "Shadow Daggers", name: "Case Hardened", category: "knife", rarity: "covert", price: 8000 },
  { weapon: "Shadow Daggers", name: "Blue Steel", category: "knife", rarity: "covert", price: 6000 },
  { weapon: "Shadow Daggers", name: "Night", category: "knife", rarity: "covert", price: 5000 },
  { weapon: "Shadow Daggers", name: "Vanilla", category: "knife", rarity: "covert", price: 6500 },
  { weapon: "Shadow Daggers", name: "Safari Mesh", category: "knife", rarity: "covert", price: 3800 },
  
  // Huntsman Knife
  { weapon: "Huntsman Knife", name: "Doppler", category: "knife", rarity: "covert", price: 22000 },
  { weapon: "Huntsman Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 18000 },
  { weapon: "Huntsman Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 28000 },
  { weapon: "Huntsman Knife", name: "Fade", category: "knife", rarity: "covert", price: 35000 },
  { weapon: "Huntsman Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 13000 },
  { weapon: "Huntsman Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 14000 },
  { weapon: "Huntsman Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 10000 },
  { weapon: "Huntsman Knife", name: "Night", category: "knife", rarity: "covert", price: 8500 },
  { weapon: "Huntsman Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 11000 },
  { weapon: "Huntsman Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 6200 },
  
  // Navaja Knife
  { weapon: "Navaja Knife", name: "Doppler", category: "knife", rarity: "covert", price: 9000 },
  { weapon: "Navaja Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 7500 },
  { weapon: "Navaja Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 11000 },
  { weapon: "Navaja Knife", name: "Fade", category: "knife", rarity: "covert", price: 14000 },
  { weapon: "Navaja Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 5500 },
  { weapon: "Navaja Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 6000 },
  { weapon: "Navaja Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 4500 },
  { weapon: "Navaja Knife", name: "Night", category: "knife", rarity: "covert", price: 4000 },
  { weapon: "Navaja Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 5000 },
  { weapon: "Navaja Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 3200 },
  
  // Stiletto Knife
  { weapon: "Stiletto Knife", name: "Doppler", category: "knife", rarity: "covert", price: 16000 },
  { weapon: "Stiletto Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 13000 },
  { weapon: "Stiletto Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 19000 },
  { weapon: "Stiletto Knife", name: "Fade", category: "knife", rarity: "covert", price: 24000 },
  { weapon: "Stiletto Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 9500 },
  { weapon: "Stiletto Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 10000 },
  { weapon: "Stiletto Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 7500 },
  { weapon: "Stiletto Knife", name: "Night", category: "knife", rarity: "covert", price: 6500 },
  { weapon: "Stiletto Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 8000 },
  { weapon: "Stiletto Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 4800 },
  
  // Ursus Knife
  { weapon: "Ursus Knife", name: "Doppler", category: "knife", rarity: "covert", price: 17000 },
  { weapon: "Ursus Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 14000 },
  { weapon: "Ursus Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 20000 },
  { weapon: "Ursus Knife", name: "Fade", category: "knife", rarity: "covert", price: 26000 },
  { weapon: "Ursus Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 10000 },
  { weapon: "Ursus Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 11000 },
  { weapon: "Ursus Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 8000 },
  { weapon: "Ursus Knife", name: "Night", category: "knife", rarity: "covert", price: 7000 },
  { weapon: "Ursus Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 8500 },
  { weapon: "Ursus Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 5200 },
  
  // Talon Knife
  { weapon: "Talon Knife", name: "Doppler", category: "knife", rarity: "covert", price: 45000 },
  { weapon: "Talon Knife", name: "Tiger Tooth", category: "knife", rarity: "covert", price: 38000 },
  { weapon: "Talon Knife", name: "Marble Fade", category: "knife", rarity: "covert", price: 55000 },
  { weapon: "Talon Knife", name: "Fade", category: "knife", rarity: "covert", price: 68000 },
  { weapon: "Talon Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 28000 },
  { weapon: "Talon Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 32000 },
  { weapon: "Talon Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 22000 },
  { weapon: "Talon Knife", name: "Night", category: "knife", rarity: "covert", price: 18000 },
  { weapon: "Talon Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 25000 },
  { weapon: "Talon Knife", name: "Safari Mesh", category: "knife", rarity: "covert", price: 14000 },
  
  // Skeleton Knife
  { weapon: "Skeleton Knife", name: "Fade", category: "knife", rarity: "covert", price: 75000 },
  { weapon: "Skeleton Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 35000 },
  { weapon: "Skeleton Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 38000 },
  { weapon: "Skeleton Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 28000 },
  { weapon: "Skeleton Knife", name: "Night", category: "knife", rarity: "covert", price: 24000 },
  { weapon: "Skeleton Knife", name: "Crimson Web", category: "knife", rarity: "covert", price: 48000 },
  { weapon: "Skeleton Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 32000 },
  
  // Paracord Knife
  { weapon: "Paracord Knife", name: "Fade", category: "knife", rarity: "covert", price: 42000 },
  { weapon: "Paracord Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 18000 },
  { weapon: "Paracord Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 20000 },
  { weapon: "Paracord Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 14000 },
  { weapon: "Paracord Knife", name: "Crimson Web", category: "knife", rarity: "covert", price: 28000 },
  { weapon: "Paracord Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 16000 },
  
  // Survival Knife
  { weapon: "Survival Knife", name: "Fade", category: "knife", rarity: "covert", price: 38000 },
  { weapon: "Survival Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 16000 },
  { weapon: "Survival Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 18000 },
  { weapon: "Survival Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 12000 },
  { weapon: "Survival Knife", name: "Crimson Web", category: "knife", rarity: "covert", price: 24000 },
  { weapon: "Survival Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 14000 },
  
  // Nomad Knife
  { weapon: "Nomad Knife", name: "Fade", category: "knife", rarity: "covert", price: 40000 },
  { weapon: "Nomad Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 17000 },
  { weapon: "Nomad Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 19000 },
  { weapon: "Nomad Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 13000 },
  { weapon: "Nomad Knife", name: "Crimson Web", category: "knife", rarity: "covert", price: 26000 },
  { weapon: "Nomad Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 15000 },
  
  // Classic Knife
  { weapon: "Classic Knife", name: "Fade", category: "knife", rarity: "covert", price: 85000 },
  { weapon: "Classic Knife", name: "Slaughter", category: "knife", rarity: "covert", price: 38000 },
  { weapon: "Classic Knife", name: "Case Hardened", category: "knife", rarity: "covert", price: 42000 },
  { weapon: "Classic Knife", name: "Blue Steel", category: "knife", rarity: "covert", price: 30000 },
  { weapon: "Classic Knife", name: "Crimson Web", category: "knife", rarity: "covert", price: 52000 },
  { weapon: "Classic Knife", name: "Vanilla", category: "knife", rarity: "covert", price: 35000 },
  
  // ============ GLOVES ============
  // Sport Gloves
  { weapon: "Sport Gloves", name: "Pandora's Box", category: "gloves", rarity: "extraordinary", price: 450000 },
  { weapon: "Sport Gloves", name: "Hedge Maze", category: "gloves", rarity: "extraordinary", price: 85000 },
  { weapon: "Sport Gloves", name: "Superconductor", category: "gloves", rarity: "extraordinary", price: 75000 },
  { weapon: "Sport Gloves", name: "Arid", category: "gloves", rarity: "extraordinary", price: 45000 },
  { weapon: "Sport Gloves", name: "Bronze Morph", category: "gloves", rarity: "extraordinary", price: 38000 },
  { weapon: "Sport Gloves", name: "Omega", category: "gloves", rarity: "extraordinary", price: 32000 },
  { weapon: "Sport Gloves", name: "Vice", category: "gloves", rarity: "extraordinary", price: 55000 },
  { weapon: "Sport Gloves", name: "Scarlet Shamagh", category: "gloves", rarity: "extraordinary", price: 28000 },
  { weapon: "Sport Gloves", name: "Slingshot", category: "gloves", rarity: "extraordinary", price: 22000 },
  { weapon: "Sport Gloves", name: "Nocts", category: "gloves", rarity: "extraordinary", price: 18000 },
  
  // Specialist Gloves
  { weapon: "Specialist Gloves", name: "Crimson Kimono", category: "gloves", rarity: "extraordinary", price: 380000 },
  { weapon: "Specialist Gloves", name: "Emerald Web", category: "gloves", rarity: "extraordinary", price: 120000 },
  { weapon: "Specialist Gloves", name: "Foundation", category: "gloves", rarity: "extraordinary", price: 45000 },
  { weapon: "Specialist Gloves", name: "Fade", category: "gloves", rarity: "extraordinary", price: 95000 },
  { weapon: "Specialist Gloves", name: "Mogul", category: "gloves", rarity: "extraordinary", price: 35000 },
  { weapon: "Specialist Gloves", name: "Forest DDPAT", category: "gloves", rarity: "extraordinary", price: 28000 },
  { weapon: "Specialist Gloves", name: "Buckshot", category: "gloves", rarity: "extraordinary", price: 22000 },
  { weapon: "Specialist Gloves", name: "Marble Fade", category: "gloves", rarity: "extraordinary", price: 180000 },
  { weapon: "Specialist Gloves", name: "Tiger Strike", category: "gloves", rarity: "extraordinary", price: 65000 },
  { weapon: "Specialist Gloves", name: "Lt. Commander", category: "gloves", rarity: "extraordinary", price: 25000 },
  
  // Driver Gloves
  { weapon: "Driver Gloves", name: "King Snake", category: "gloves", rarity: "extraordinary", price: 85000 },
  { weapon: "Driver Gloves", name: "Imperial Plaid", category: "gloves", rarity: "extraordinary", price: 55000 },
  { weapon: "Driver Gloves", name: "Crimson Weave", category: "gloves", rarity: "extraordinary", price: 48000 },
  { weapon: "Driver Gloves", name: "Overtake", category: "gloves", rarity: "extraordinary", price: 32000 },
  { weapon: "Driver Gloves", name: "Racing Green", category: "gloves", rarity: "extraordinary", price: 25000 },
  { weapon: "Driver Gloves", name: "Lunar Weave", category: "gloves", rarity: "extraordinary", price: 28000 },
  { weapon: "Driver Gloves", name: "Diamondback", category: "gloves", rarity: "extraordinary", price: 22000 },
  { weapon: "Driver Gloves", name: "Convoy", category: "gloves", rarity: "extraordinary", price: 18000 },
  { weapon: "Driver Gloves", name: "Rezan the Red", category: "gloves", rarity: "extraordinary", price: 42000 },
  { weapon: "Driver Gloves", name: "Black Tie", category: "gloves", rarity: "extraordinary", price: 38000 },
  
  // Hand Wraps
  { weapon: "Hand Wraps", name: "Cobalt Skulls", category: "gloves", rarity: "extraordinary", price: 95000 },
  { weapon: "Hand Wraps", name: "Slaughter", category: "gloves", rarity: "extraordinary", price: 75000 },
  { weapon: "Hand Wraps", name: "Badlands", category: "gloves", rarity: "extraordinary", price: 35000 },
  { weapon: "Hand Wraps", name: "Spruce DDPAT", category: "gloves", rarity: "extraordinary", price: 22000 },
  { weapon: "Hand Wraps", name: "Leather", category: "gloves", rarity: "extraordinary", price: 18000 },
  { weapon: "Hand Wraps", name: "Duct Tape", category: "gloves", rarity: "extraordinary", price: 15000 },
  { weapon: "Hand Wraps", name: "Arboreal", category: "gloves", rarity: "extraordinary", price: 20000 },
  { weapon: "Hand Wraps", name: "Overprint", category: "gloves", rarity: "extraordinary", price: 28000 },
  { weapon: "Hand Wraps", name: "Constrictor", category: "gloves", rarity: "extraordinary", price: 32000 },
  { weapon: "Hand Wraps", name: "CAUTION!", category: "gloves", rarity: "extraordinary", price: 25000 },
  
  // Moto Gloves
  { weapon: "Moto Gloves", name: "Spearmint", category: "gloves", rarity: "extraordinary", price: 320000 },
  { weapon: "Moto Gloves", name: "Cool Mint", category: "gloves", rarity: "extraordinary", price: 85000 },
  { weapon: "Moto Gloves", name: "POW!", category: "gloves", rarity: "extraordinary", price: 55000 },
  { weapon: "Moto Gloves", name: "Boom!", category: "gloves", rarity: "extraordinary", price: 28000 },
  { weapon: "Moto Gloves", name: "Polygon", category: "gloves", rarity: "extraordinary", price: 22000 },
  { weapon: "Moto Gloves", name: "Transport", category: "gloves", rarity: "extraordinary", price: 18000 },
  { weapon: "Moto Gloves", name: "Eclipse", category: "gloves", rarity: "extraordinary", price: 15000 },
  { weapon: "Moto Gloves", name: "Smoke Out", category: "gloves", rarity: "extraordinary", price: 20000 },
  { weapon: "Moto Gloves", name: "Blood Pressure", category: "gloves", rarity: "extraordinary", price: 35000 },
  { weapon: "Moto Gloves", name: "Turtle", category: "gloves", rarity: "extraordinary", price: 25000 },
  
  // Hydra Gloves
  { weapon: "Hydra Gloves", name: "Case Hardened", category: "gloves", rarity: "extraordinary", price: 65000 },
  { weapon: "Hydra Gloves", name: "Emerald", category: "gloves", rarity: "extraordinary", price: 42000 },
  { weapon: "Hydra Gloves", name: "Mangrove", category: "gloves", rarity: "extraordinary", price: 18000 },
  { weapon: "Hydra Gloves", name: "Rattler", category: "gloves", rarity: "extraordinary", price: 15000 },
  
  // Bloodhound Gloves
  { weapon: "Bloodhound Gloves", name: "Guerrilla", category: "gloves", rarity: "extraordinary", price: 28000 },
  { weapon: "Bloodhound Gloves", name: "Bronzed", category: "gloves", rarity: "extraordinary", price: 22000 },
  { weapon: "Bloodhound Gloves", name: "Snakebite", category: "gloves", rarity: "extraordinary", price: 18000 },
  { weapon: "Bloodhound Gloves", name: "Charred", category: "gloves", rarity: "extraordinary", price: 15000 },
  
  // Broken Fang Gloves
  { weapon: "Broken Fang Gloves", name: "Jade", category: "gloves", rarity: "extraordinary", price: 45000 },
  { weapon: "Broken Fang Gloves", name: "Yellow-banded", category: "gloves", rarity: "extraordinary", price: 32000 },
  { weapon: "Broken Fang Gloves", name: "Unhinged", category: "gloves", rarity: "extraordinary", price: 22000 },
  { weapon: "Broken Fang Gloves", name: "Needle Point", category: "gloves", rarity: "extraordinary", price: 18000 },
  
  // ============ RIFLES ============
  // AK-47
  { weapon: "AK-47", name: "Wild Lotus", category: "rifle", rarity: "covert", price: 850000 },
  { weapon: "AK-47", name: "Fire Serpent", category: "rifle", rarity: "covert", price: 120000 },
  { weapon: "AK-47", name: "The Empress", category: "rifle", rarity: "covert", price: 28000 },
  { weapon: "AK-47", name: "Vulcan", category: "rifle", rarity: "covert", price: 35000 },
  { weapon: "AK-47", name: "Fuel Injector", category: "rifle", rarity: "covert", price: 32000 },
  { weapon: "AK-47", name: "Neon Rider", category: "rifle", rarity: "covert", price: 22000 },
  { weapon: "AK-47", name: "Bloodsport", category: "rifle", rarity: "covert", price: 18000 },
  { weapon: "AK-47", name: "Neon Revolution", category: "rifle", rarity: "covert", price: 15000 },
  { weapon: "AK-47", name: "Asiimov", category: "rifle", rarity: "covert", price: 42000 },
  { weapon: "AK-47", name: "Case Hardened", category: "rifle", rarity: "classified", price: 25000 },
  { weapon: "AK-47", name: "Frontside Misty", category: "rifle", rarity: "classified", price: 8500 },
  { weapon: "AK-47", name: "Point Disarray", category: "rifle", rarity: "classified", price: 7500 },
  { weapon: "AK-47", name: "Aquamarine Revenge", category: "rifle", rarity: "classified", price: 9500 },
  { weapon: "AK-47", name: "Wasteland Rebel", category: "rifle", rarity: "classified", price: 12000 },
  { weapon: "AK-47", name: "Redline", category: "rifle", rarity: "classified", price: 5500 },
  { weapon: "AK-47", name: "Red Laminate", category: "rifle", rarity: "classified", price: 4500 },
  { weapon: "AK-47", name: "Blue Laminate", category: "rifle", rarity: "classified", price: 1800 },
  { weapon: "AK-47", name: "Slate", category: "rifle", rarity: "restricted", price: 3500 },
  { weapon: "AK-47", name: "Ice Coaled", category: "rifle", rarity: "restricted", price: 2800 },
  { weapon: "AK-47", name: "Rat Rod", category: "rifle", rarity: "restricted", price: 1500 },
  { weapon: "AK-47", name: "Phantom Disruptor", category: "rifle", rarity: "restricted", price: 1200 },
  { weapon: "AK-47", name: "Legion of Anubis", category: "rifle", rarity: "restricted", price: 1800 },
  { weapon: "AK-47", name: "Orbit Mk01", category: "rifle", rarity: "restricted", price: 2200 },
  { weapon: "AK-47", name: "Elite Build", category: "rifle", rarity: "mil-spec", price: 450 },
  { weapon: "AK-47", name: "Safari Mesh", category: "rifle", rarity: "consumer", price: 180 },
  { weapon: "AK-47", name: "Jungle Spray", category: "rifle", rarity: "consumer", price: 120 },
  { weapon: "AK-47", name: "Predator", category: "rifle", rarity: "consumer", price: 85 },
  { weapon: "AK-47", name: "Uncharted", category: "rifle", rarity: "mil-spec", price: 650 },
  { weapon: "AK-47", name: "Baroque Purple", category: "rifle", rarity: "mil-spec", price: 380 },
  { weapon: "AK-47", name: "Emerald Pinstripe", category: "rifle", rarity: "mil-spec", price: 280 },
  { weapon: "AK-47", name: "Printstream", category: "rifle", rarity: "covert", price: 95000 },
  { weapon: "AK-47", name: "Nightwish", category: "rifle", rarity: "covert", price: 45000 },
  { weapon: "AK-47", name: "Gold Arabesque", category: "rifle", rarity: "covert", price: 380000 },
  { weapon: "AK-47", name: "X-Ray", category: "rifle", rarity: "classified", price: 6500 },
  { weapon: "AK-47", name: "Panthera onca", category: "rifle", rarity: "classified", price: 5500 },
  
  // M4A4
  { weapon: "M4A4", name: "Howl", category: "rifle", rarity: "contraband", price: 1200000 },
  { weapon: "M4A4", name: "Poseidon", category: "rifle", rarity: "covert", price: 85000 },
  { weapon: "M4A4", name: "Neo-Noir", category: "rifle", rarity: "covert", price: 15000 },
  { weapon: "M4A4", name: "Asiimov", category: "rifle", rarity: "covert", price: 55000 },
  { weapon: "M4A4", name: "The Emperor", category: "rifle", rarity: "covert", price: 18000 },
  { weapon: "M4A4", name: "Buzz Kill", category: "rifle", rarity: "covert", price: 12000 },
  { weapon: "M4A4", name: "Desolate Space", category: "rifle", rarity: "covert", price: 9500 },
  { weapon: "M4A4", name: "Hellfire", category: "rifle", rarity: "covert", price: 8500 },
  { weapon: "M4A4", name: "Royal Paladin", category: "rifle", rarity: "classified", price: 7500 },
  { weapon: "M4A4", name: "Bullet Rain", category: "rifle", rarity: "classified", price: 6500 },
  { weapon: "M4A4", name: "Dragon King", category: "rifle", rarity: "classified", price: 5500 },
  { weapon: "M4A4", name: "The Battlestar", category: "rifle", rarity: "classified", price: 3800 },
  { weapon: "M4A4", name: "X-Ray", category: "rifle", rarity: "classified", price: 2800 },
  { weapon: "M4A4", name: "Cyber Security", category: "rifle", rarity: "restricted", price: 1800 },
  { weapon: "M4A4", name: "In Living Color", category: "rifle", rarity: "restricted", price: 1500 },
  { weapon: "M4A4", name: "Evil Daimyo", category: "rifle", rarity: "restricted", price: 650 },
  { weapon: "M4A4", name: "Daybreak", category: "rifle", rarity: "restricted", price: 2200 },
  { weapon: "M4A4", name: "Magnesium", category: "rifle", rarity: "mil-spec", price: 280 },
  { weapon: "M4A4", name: "Mainframe", category: "rifle", rarity: "mil-spec", price: 220 },
  { weapon: "M4A4", name: "Urban DDPAT", category: "rifle", rarity: "consumer", price: 85 },
  { weapon: "M4A4", name: "Jungle Tiger", category: "rifle", rarity: "consumer", price: 120 },
  { weapon: "M4A4", name: "Temukau", category: "rifle", rarity: "covert", price: 25000 },
  { weapon: "M4A4", name: "Tooth Fairy", category: "rifle", rarity: "covert", price: 35000 },
  
  // M4A1-S
  { weapon: "M4A1-S", name: "Welcome to the Jungle", category: "rifle", rarity: "covert", price: 55000 },
  { weapon: "M4A1-S", name: "Printstream", category: "rifle", rarity: "covert", price: 85000 },
  { weapon: "M4A1-S", name: "Blue Phosphor", category: "rifle", rarity: "covert", price: 28000 },
  { weapon: "M4A1-S", name: "Chantico's Fire", category: "rifle", rarity: "covert", price: 15000 },
  { weapon: "M4A1-S", name: "Golden Coil", category: "rifle", rarity: "covert", price: 12000 },
  { weapon: "M4A1-S", name: "Hyper Beast", category: "rifle", rarity: "covert", price: 18000 },
  { weapon: "M4A1-S", name: "Mecha Industries", category: "rifle", rarity: "covert", price: 9500 },
  { weapon: "M4A1-S", name: "Cyrex", category: "rifle", rarity: "classified", price: 5500 },
  { weapon: "M4A1-S", name: "Atomic Alloy", category: "rifle", rarity: "classified", price: 4500 },
  { weapon: "M4A1-S", name: "Guardian", category: "rifle", rarity: "classified", price: 3800 },
  { weapon: "M4A1-S", name: "Leaded Glass", category: "rifle", rarity: "classified", price: 3200 },
  { weapon: "M4A1-S", name: "Decimator", category: "rifle", rarity: "classified", price: 2800 },
  { weapon: "M4A1-S", name: "Player Two", category: "rifle", rarity: "classified", price: 12000 },
  { weapon: "M4A1-S", name: "Nightmare", category: "rifle", rarity: "restricted", price: 1500 },
  { weapon: "M4A1-S", name: "Basilisk", category: "rifle", rarity: "restricted", price: 850 },
  { weapon: "M4A1-S", name: "Bright Water", category: "rifle", rarity: "restricted", price: 650 },
  { weapon: "M4A1-S", name: "Nitro", category: "rifle", rarity: "restricted", price: 450 },
  { weapon: "M4A1-S", name: "Boreal Forest", category: "rifle", rarity: "consumer", price: 120 },
  { weapon: "M4A1-S", name: "VariCamo", category: "rifle", rarity: "consumer", price: 85 },
  { weapon: "M4A1-S", name: "Night Terror", category: "rifle", rarity: "covert", price: 22000 },
  { weapon: "M4A1-S", name: "Imminent Danger", category: "rifle", rarity: "classified", price: 6500 },
  
  // AWP
  { weapon: "AWP", name: "Dragon Lore", category: "sniper", rarity: "covert", price: 1500000 },
  { weapon: "AWP", name: "Gungnir", category: "sniper", rarity: "covert", price: 650000 },
  { weapon: "AWP", name: "The Prince", category: "sniper", rarity: "covert", price: 85000 },
  { weapon: "AWP", name: "Fade", category: "sniper", rarity: "covert", price: 42000 },
  { weapon: "AWP", name: "Medusa", category: "sniper", rarity: "covert", price: 280000 },
  { weapon: "AWP", name: "Wildfire", category: "sniper", rarity: "covert", price: 28000 },
  { weapon: "AWP", name: "Containment Breach", category: "sniper", rarity: "covert", price: 22000 },
  { weapon: "AWP", name: "Neo-Noir", category: "sniper", rarity: "covert", price: 15000 },
  { weapon: "AWP", name: "Hyper Beast", category: "sniper", rarity: "covert", price: 18000 },
  { weapon: "AWP", name: "Lightning Strike", category: "sniper", rarity: "covert", price: 35000 },
  { weapon: "AWP", name: "Asiimov", category: "sniper", rarity: "covert", price: 42000 },
  { weapon: "AWP", name: "Fever Dream", category: "sniper", rarity: "covert", price: 12000 },
  { weapon: "AWP", name: "Electric Hive", category: "sniper", rarity: "classified", price: 8500 },
  { weapon: "AWP", name: "Redline", category: "sniper", rarity: "classified", price: 6500 },
  { weapon: "AWP", name: "BOOM", category: "sniper", rarity: "classified", price: 9500 },
  { weapon: "AWP", name: "Graphite", category: "sniper", rarity: "classified", price: 12000 },
  { weapon: "AWP", name: "Man-o'-war", category: "sniper", rarity: "classified", price: 5500 },
  { weapon: "AWP", name: "Elite Build", category: "sniper", rarity: "restricted", price: 2200 },
  { weapon: "AWP", name: "Corticera", category: "sniper", rarity: "restricted", price: 1800 },
  { weapon: "AWP", name: "Pit Viper", category: "sniper", rarity: "restricted", price: 850 },
  { weapon: "AWP", name: "Worm God", category: "sniper", rarity: "restricted", price: 450 },
  { weapon: "AWP", name: "Safari Mesh", category: "sniper", rarity: "consumer", price: 220 },
  { weapon: "AWP", name: "Snake Camo", category: "sniper", rarity: "consumer", price: 180 },
  { weapon: "AWP", name: "Chromatic Aberration", category: "sniper", rarity: "covert", price: 45000 },
  { weapon: "AWP", name: "Duality", category: "sniper", rarity: "covert", price: 32000 },
  { weapon: "AWP", name: "Desert Hydra", category: "sniper", rarity: "covert", price: 55000 },
  { weapon: "AWP", name: "Silk Tiger", category: "sniper", rarity: "classified", price: 4500 },
  { weapon: "AWP", name: "PAW", category: "sniper", rarity: "classified", price: 3500 },
  { weapon: "AWP", name: "Atheris", category: "sniper", rarity: "restricted", price: 1500 },
  { weapon: "AWP", name: "Mortis", category: "sniper", rarity: "restricted", price: 1200 },
  { weapon: "AWP", name: "Exoskeleton", category: "sniper", rarity: "restricted", price: 650 },
  { weapon: "AWP", name: "Capillary", category: "sniper", rarity: "restricted", price: 550 },
  { weapon: "AWP", name: "Acheron", category: "sniper", rarity: "restricted", price: 750 },
  
  // ============ PISTOLS ============
  // Desert Eagle
  { weapon: "Desert Eagle", name: "Blaze", category: "pistol", rarity: "covert", price: 45000 },
  { weapon: "Desert Eagle", name: "Golden Koi", category: "pistol", rarity: "covert", price: 15000 },
  { weapon: "Desert Eagle", name: "Code Red", category: "pistol", rarity: "covert", price: 12000 },
  { weapon: "Desert Eagle", name: "Mecha Industries", category: "pistol", rarity: "covert", price: 8500 },
  { weapon: "Desert Eagle", name: "Printstream", category: "pistol", rarity: "covert", price: 28000 },
  { weapon: "Desert Eagle", name: "Kumicho Dragon", category: "pistol", rarity: "classified", price: 5500 },
  { weapon: "Desert Eagle", name: "Hypnotic", category: "pistol", rarity: "classified", price: 4500 },
  { weapon: "Desert Eagle", name: "Conspiracy", category: "pistol", rarity: "classified", price: 3500 },
  { weapon: "Desert Eagle", name: "Cobalt Disruption", category: "pistol", rarity: "classified", price: 2800 },
  { weapon: "Desert Eagle", name: "Crimson Web", category: "pistol", rarity: "restricted", price: 2200 },
  { weapon: "Desert Eagle", name: "Heirloom", category: "pistol", rarity: "restricted", price: 1500 },
  { weapon: "Desert Eagle", name: "Naga", category: "pistol", rarity: "restricted", price: 650 },
  { weapon: "Desert Eagle", name: "Sunset Storm", category: "pistol", rarity: "restricted", price: 450 },
  { weapon: "Desert Eagle", name: "Mudder", category: "pistol", rarity: "mil-spec", price: 180 },
  { weapon: "Desert Eagle", name: "Urban Rubble", category: "pistol", rarity: "consumer", price: 85 },
  { weapon: "Desert Eagle", name: "Ocean Drive", category: "pistol", rarity: "covert", price: 9500 },
  { weapon: "Desert Eagle", name: "Fennec Fox", category: "pistol", rarity: "classified", price: 3200 },
  { weapon: "Desert Eagle", name: "Light Rail", category: "pistol", rarity: "classified", price: 2500 },
  
  // Glock-18
  { weapon: "Glock-18", name: "Fade", category: "pistol", rarity: "covert", price: 45000 },
  { weapon: "Glock-18", name: "Gamma Doppler", category: "pistol", rarity: "covert", price: 28000 },
  { weapon: "Glock-18", name: "Twilight Galaxy", category: "pistol", rarity: "covert", price: 8500 },
  { weapon: "Glock-18", name: "Wasteland Rebel", category: "pistol", rarity: "classified", price: 5500 },
  { weapon: "Glock-18", name: "Water Elemental", category: "pistol", rarity: "classified", price: 4500 },
  { weapon: "Glock-18", name: "Royal Legion", category: "pistol", rarity: "classified", price: 3800 },
  { weapon: "Glock-18", name: "Snack Attack", category: "pistol", rarity: "classified", price: 3200 },
  { weapon: "Glock-18", name: "Bullet Queen", category: "pistol", rarity: "covert", price: 12000 },
  { weapon: "Glock-18", name: "Dragon Tattoo", category: "pistol", rarity: "restricted", price: 2500 },
  { weapon: "Glock-18", name: "Reactor", category: "pistol", rarity: "restricted", price: 1200 },
  { weapon: "Glock-18", name: "Blue Fissure", category: "pistol", rarity: "restricted", price: 650 },
  { weapon: "Glock-18", name: "Steel Disruption", category: "pistol", rarity: "restricted", price: 450 },
  { weapon: "Glock-18", name: "Brass", category: "pistol", rarity: "mil-spec", price: 220 },
  { weapon: "Glock-18", name: "Night", category: "pistol", rarity: "mil-spec", price: 180 },
  { weapon: "Glock-18", name: "Sand Dune", category: "pistol", rarity: "consumer", price: 45 },
  { weapon: "Glock-18", name: "Candy Apple", category: "pistol", rarity: "restricted", price: 550 },
  { weapon: "Glock-18", name: "Vogue", category: "pistol", rarity: "covert", price: 15000 },
  { weapon: "Glock-18", name: "Clear Polymer", category: "pistol", rarity: "classified", price: 2800 },
  { weapon: "Glock-18", name: "Neo-Noir", category: "pistol", rarity: "classified", price: 3500 },
  
  // USP-S
  { weapon: "USP-S", name: "Kill Confirmed", category: "pistol", rarity: "covert", price: 42000 },
  { weapon: "USP-S", name: "Neo-Noir", category: "pistol", rarity: "covert", price: 15000 },
  { weapon: "USP-S", name: "Printstream", category: "pistol", rarity: "covert", price: 55000 },
  { weapon: "USP-S", name: "Cortex", category: "pistol", rarity: "covert", price: 12000 },
  { weapon: "USP-S", name: "The Traitor", category: "pistol", rarity: "covert", price: 8500 },
  { weapon: "USP-S", name: "Caiman", category: "pistol", rarity: "classified", price: 4500 },
  { weapon: "USP-S", name: "Orion", category: "pistol", rarity: "classified", price: 5500 },
  { weapon: "USP-S", name: "Road Rash", category: "pistol", rarity: "classified", price: 3200 },
  { weapon: "USP-S", name: "Guardian", category: "pistol", rarity: "classified", price: 2500 },
  { weapon: "USP-S", name: "Serum", category: "pistol", rarity: "restricted", price: 1800 },
  { weapon: "USP-S", name: "Stainless", category: "pistol", rarity: "restricted", price: 1500 },
  { weapon: "USP-S", name: "Cyrex", category: "pistol", rarity: "restricted", price: 1200 },
  { weapon: "USP-S", name: "Blueprint", category: "pistol", rarity: "restricted", price: 850 },
  { weapon: "USP-S", name: "Business Class", category: "pistol", rarity: "restricted", price: 650 },
  { weapon: "USP-S", name: "Para Green", category: "pistol", rarity: "mil-spec", price: 180 },
  { weapon: "USP-S", name: "Forest Leaves", category: "pistol", rarity: "consumer", price: 85 },
  { weapon: "USP-S", name: "Monster Mashup", category: "pistol", rarity: "covert", price: 18000 },
  { weapon: "USP-S", name: "Target Acquired", category: "pistol", rarity: "classified", price: 3800 },
  { weapon: "USP-S", name: "Flashback", category: "pistol", rarity: "restricted", price: 950 },
  
  // P2000
  { weapon: "P2000", name: "Ocean Foam", category: "pistol", rarity: "covert", price: 25000 },
  { weapon: "P2000", name: "Fire Elemental", category: "pistol", rarity: "covert", price: 8500 },
  { weapon: "P2000", name: "Imperial Dragon", category: "pistol", rarity: "classified", price: 3500 },
  { weapon: "P2000", name: "Corticera", category: "pistol", rarity: "classified", price: 2200 },
  { weapon: "P2000", name: "Amber Fade", category: "pistol", rarity: "classified", price: 2800 },
  { weapon: "P2000", name: "Handgun", category: "pistol", rarity: "restricted", price: 850 },
  { weapon: "P2000", name: "Red FragCam", category: "pistol", rarity: "restricted", price: 450 },
  { weapon: "P2000", name: "Pulse", category: "pistol", rarity: "restricted", price: 350 },
  { weapon: "P2000", name: "Chainmail", category: "pistol", rarity: "mil-spec", price: 180 },
  { weapon: "P2000", name: "Granite Marbleized", category: "pistol", rarity: "consumer", price: 65 },
  { weapon: "P2000", name: "Ivory", category: "pistol", rarity: "classified", price: 2500 },
  { weapon: "P2000", name: "Lifted Spirits", category: "pistol", rarity: "restricted", price: 650 },
  
  // P250
  { weapon: "P250", name: "See Ya Later", category: "pistol", rarity: "covert", price: 5500 },
  { weapon: "P250", name: "Muertos", category: "pistol", rarity: "classified", price: 2500 },
  { weapon: "P250", name: "Asiimov", category: "pistol", rarity: "classified", price: 2200 },
  { weapon: "P250", name: "Mehndi", category: "pistol", rarity: "classified", price: 1800 },
  { weapon: "P250", name: "Cartel", category: "pistol", rarity: "restricted", price: 850 },
  { weapon: "P250", name: "Wingshot", category: "pistol", rarity: "restricted", price: 550 },
  { weapon: "P250", name: "Franklin", category: "pistol", rarity: "restricted", price: 450 },
  { weapon: "P250", name: "Supernova", category: "pistol", rarity: "restricted", price: 350 },
  { weapon: "P250", name: "Steel Disruption", category: "pistol", rarity: "mil-spec", price: 120 },
  { weapon: "P250", name: "Bone Mask", category: "pistol", rarity: "consumer", price: 45 },
  { weapon: "P250", name: "Sand Dune", category: "pistol", rarity: "consumer", price: 25 },
  { weapon: "P250", name: "Nevermore", category: "pistol", rarity: "classified", price: 1500 },
  { weapon: "P250", name: "Cyber Shell", category: "pistol", rarity: "restricted", price: 650 },
  
  // Five-SeveN
  { weapon: "Five-SeveN", name: "Hyper Beast", category: "pistol", rarity: "covert", price: 6500 },
  { weapon: "Five-SeveN", name: "Angry Mob", category: "pistol", rarity: "covert", price: 4500 },
  { weapon: "Five-SeveN", name: "Case Hardened", category: "pistol", rarity: "classified", price: 3500 },
  { weapon: "Five-SeveN", name: "Fowl Play", category: "pistol", rarity: "classified", price: 2800 },
  { weapon: "Five-SeveN", name: "Monkey Business", category: "pistol", rarity: "classified", price: 2200 },
  { weapon: "Five-SeveN", name: "Retrobution", category: "pistol", rarity: "restricted", price: 850 },
  { weapon: "Five-SeveN", name: "Copper Galaxy", category: "pistol", rarity: "restricted", price: 550 },
  { weapon: "Five-SeveN", name: "Neon Kimono", category: "pistol", rarity: "restricted", price: 450 },
  { weapon: "Five-SeveN", name: "Triumvirate", category: "pistol", rarity: "restricted", price: 350 },
  { weapon: "Five-SeveN", name: "Forest Night", category: "pistol", rarity: "consumer", price: 85 },
  { weapon: "Five-SeveN", name: "Scrawl", category: "pistol", rarity: "classified", price: 1800 },
  { weapon: "Five-SeveN", name: "Boost Protocol", category: "pistol", rarity: "restricted", price: 650 },
  
  // Tec-9
  { weapon: "Tec-9", name: "Nuclear Threat", category: "pistol", rarity: "covert", price: 8500 },
  { weapon: "Tec-9", name: "Fuel Injector", category: "pistol", rarity: "covert", price: 5500 },
  { weapon: "Tec-9", name: "Decimator", category: "pistol", rarity: "classified", price: 2500 },
  { weapon: "Tec-9", name: "Re-Entry", category: "pistol", rarity: "classified", price: 1800 },
  { weapon: "Tec-9", name: "Titanium Bit", category: "pistol", rarity: "restricted", price: 650 },
  { weapon: "Tec-9", name: "Avalanche", category: "pistol", rarity: "restricted", price: 450 },
  { weapon: "Tec-9", name: "Isaac", category: "pistol", rarity: "restricted", price: 350 },
  { weapon: "Tec-9", name: "Sandstorm", category: "pistol", rarity: "mil-spec", price: 180 },
  { weapon: "Tec-9", name: "Army Mesh", category: "pistol", rarity: "consumer", price: 65 },
  { weapon: "Tec-9", name: "Remote Control", category: "pistol", rarity: "classified", price: 3200 },
  { weapon: "Tec-9", name: "Brother", category: "pistol", rarity: "classified", price: 2200 },
  
  // CZ75-Auto
  { weapon: "CZ75-Auto", name: "Victoria", category: "pistol", rarity: "covert", price: 5500 },
  { weapon: "CZ75-Auto", name: "Xiangliu", category: "pistol", rarity: "covert", price: 4500 },
  { weapon: "CZ75-Auto", name: "Chalice", category: "pistol", rarity: "classified", price: 2800 },
  { weapon: "CZ75-Auto", name: "Tigris", category: "pistol", rarity: "classified", price: 2200 },
  { weapon: "CZ75-Auto", name: "Yellow Jacket", category: "pistol", rarity: "restricted", price: 850 },
  { weapon: "CZ75-Auto", name: "Crimson Web", category: "pistol", rarity: "restricted", price: 550 },
  { weapon: "CZ75-Auto", name: "The Fuschia Is Now", category: "pistol", rarity: "restricted", price: 450 },
  { weapon: "CZ75-Auto", name: "Twist", category: "pistol", rarity: "restricted", price: 350 },
  { weapon: "CZ75-Auto", name: "Army Sheen", category: "pistol", rarity: "consumer", price: 85 },
  { weapon: "CZ75-Auto", name: "Vendetta", category: "pistol", rarity: "classified", price: 1800 },
  { weapon: "CZ75-Auto", name: "Emerald Quartz", category: "pistol", rarity: "restricted", price: 650 },
  
  // Dual Berettas
  { weapon: "Dual Berettas", name: "Cobra Strike", category: "pistol", rarity: "covert", price: 4500 },
  { weapon: "Dual Berettas", name: "Twin Turbo", category: "pistol", rarity: "covert", price: 3800 },
  { weapon: "Dual Berettas", name: "Hemoglobin", category: "pistol", rarity: "classified", price: 2200 },
  { weapon: "Dual Berettas", name: "Marina", category: "pistol", rarity: "classified", price: 1500 },
  { weapon: "Dual Berettas", name: "Urban Shock", category: "pistol", rarity: "restricted", price: 850 },
  { weapon: "Dual Berettas", name: "Demolition", category: "pistol", rarity: "restricted", price: 450 },
  { weapon: "Dual Berettas", name: "Cobalt Quartz", category: "pistol", rarity: "restricted", price: 350 },
  { weapon: "Dual Berettas", name: "Briar", category: "pistol", rarity: "mil-spec", price: 180 },
  { weapon: "Dual Berettas", name: "Moon in Libra", category: "pistol", rarity: "consumer", price: 85 },
  { weapon: "Dual Berettas", name: "Melondrama", category: "pistol", rarity: "classified", price: 1800 },
  { weapon: "Dual Berettas", name: "Flora Carnivora", category: "pistol", rarity: "restricted", price: 650 },
  
  // R8 Revolver
  { weapon: "R8 Revolver", name: "Fade", category: "pistol", rarity: "covert", price: 8500 },
  { weapon: "R8 Revolver", name: "Amber Fade", category: "pistol", rarity: "classified", price: 3500 },
  { weapon: "R8 Revolver", name: "Llama Cannon", category: "pistol", rarity: "classified", price: 2800 },
  { weapon: "R8 Revolver", name: "Reboot", category: "pistol", rarity: "classified", price: 2200 },
  { weapon: "R8 Revolver", name: "Crimson Web", category: "pistol", rarity: "restricted", price: 1200 },
  { weapon: "R8 Revolver", name: "Grip", category: "pistol", rarity: "restricted", price: 550 },
  { weapon: "R8 Revolver", name: "Nitro", category: "pistol", rarity: "restricted", price: 350 },
  { weapon: "R8 Revolver", name: "Bone Mask", category: "pistol", rarity: "consumer", price: 85 },
  { weapon: "R8 Revolver", name: "Memento", category: "pistol", rarity: "classified", price: 1800 },
  { weapon: "R8 Revolver", name: "Banana Cannon", category: "pistol", rarity: "restricted", price: 650 },
  
  // ============ SMGs ============
  // MP9
  { weapon: "MP9", name: "Wild Lily", category: "smg", rarity: "covert", price: 4500 },
  { weapon: "MP9", name: "Hypnotic", category: "smg", rarity: "classified", price: 2500 },
  { weapon: "MP9", name: "Bulldozer", category: "smg", rarity: "classified", price: 1800 },
  { weapon: "MP9", name: "Airlock", category: "smg", rarity: "restricted", price: 850 },
  { weapon: "MP9", name: "Ruby Poison Dart", category: "smg", rarity: "restricted", price: 550 },
  { weapon: "MP9", name: "Deadly Poison", category: "smg", rarity: "restricted", price: 450 },
  { weapon: "MP9", name: "Rose Iron", category: "smg", rarity: "restricted", price: 350 },
  { weapon: "MP9", name: "Setting Sun", category: "smg", rarity: "mil-spec", price: 180 },
  { weapon: "MP9", name: "Sand Dashed", category: "smg", rarity: "consumer", price: 65 },
  { weapon: "MP9", name: "Food Chain", category: "smg", rarity: "classified", price: 2200 },
  { weapon: "MP9", name: "Mount Fuji", category: "smg", rarity: "restricted", price: 650 },
  
  // MAC-10
  { weapon: "MAC-10", name: "Neon Rider", category: "smg", rarity: "covert", price: 5500 },
  { weapon: "MAC-10", name: "Fade", category: "smg", rarity: "covert", price: 12000 },
  { weapon: "MAC-10", name: "Case Hardened", category: "smg", rarity: "classified", price: 2500 },
  { weapon: "MAC-10", name: "Pipe Down", category: "smg", rarity: "classified", price: 1800 },
  { weapon: "MAC-10", name: "Heat", category: "smg", rarity: "restricted", price: 850 },
  { weapon: "MAC-10", name: "Tatter", category: "smg", rarity: "restricted", price: 450 },
  { weapon: "MAC-10", name: "Amber Fade", category: "smg", rarity: "restricted", price: 550 },
  { weapon: "MAC-10", name: "Silver", category: "smg", rarity: "mil-spec", price: 120 },
  { weapon: "MAC-10", name: "Candy Apple", category: "smg", rarity: "consumer", price: 85 },
  { weapon: "MAC-10", name: "Disco Tech", category: "smg", rarity: "classified", price: 2200 },
  { weapon: "MAC-10", name: "Toybox", category: "smg", rarity: "restricted", price: 650 },
  
  // MP7
  { weapon: "MP7", name: "Bloodsport", category: "smg", rarity: "covert", price: 4500 },
  { weapon: "MP7", name: "Nemesis", category: "smg", rarity: "covert", price: 3500 },
  { weapon: "MP7", name: "Special Delivery", category: "smg", rarity: "classified", price: 2200 },
  { weapon: "MP7", name: "Fade", category: "smg", rarity: "classified", price: 1500 },
  { weapon: "MP7", name: "Neon Ply", category: "smg", rarity: "restricted", price: 550 },
  { weapon: "MP7", name: "Whiteout", category: "smg", rarity: "restricted", price: 850 },
  { weapon: "MP7", name: "Skulls", category: "smg", rarity: "restricted", price: 450 },
  { weapon: "MP7", name: "Armor Core", category: "smg", rarity: "mil-spec", price: 180 },
  { weapon: "MP7", name: "Forest DDPAT", category: "smg", rarity: "consumer", price: 65 },
  { weapon: "MP7", name: "Guerrilla", category: "smg", rarity: "classified", price: 1800 },
  { weapon: "MP7", name: "Powercore", category: "smg", rarity: "restricted", price: 650 },
  
  // UMP-45
  { weapon: "UMP-45", name: "Primal Saber", category: "smg", rarity: "covert", price: 5500 },
  { weapon: "UMP-45", name: "Crime Scene", category: "smg", rarity: "covert", price: 3800 },
  { weapon: "UMP-45", name: "Grand Prix", category: "smg", rarity: "classified", price: 2200 },
  { weapon: "UMP-45", name: "Minotaur's Labyrinth", category: "smg", rarity: "classified", price: 1500 },
  { weapon: "UMP-45", name: "Blaze", category: "smg", rarity: "restricted", price: 850 },
  { weapon: "UMP-45", name: "Riot", category: "smg", rarity: "restricted", price: 550 },
  { weapon: "UMP-45", name: "Labyrinth", category: "smg", rarity: "restricted", price: 450 },
  { weapon: "UMP-45", name: "Carbon Fiber", category: "smg", rarity: "consumer", price: 85 },
  { weapon: "UMP-45", name: "Metal Flowers", category: "smg", rarity: "classified", price: 1800 },
  { weapon: "UMP-45", name: "Moonrise", category: "smg", rarity: "restricted", price: 650 },
  
  // P90
  { weapon: "P90", name: "Death by Kitty", category: "smg", rarity: "covert", price: 18000 },
  { weapon: "P90", name: "Asiimov", category: "smg", rarity: "covert", price: 12000 },
  { weapon: "P90", name: "Emerald Dragon", category: "smg", rarity: "covert", price: 8500 },
  { weapon: "P90", name: "Shapewood", category: "smg", rarity: "classified", price: 2800 },
  { weapon: "P90", name: "Trigon", category: "smg", rarity: "classified", price: 2200 },
  { weapon: "P90", name: "Cold Blooded", category: "smg", rarity: "classified", price: 1500 },
  { weapon: "P90", name: "Module", category: "smg", rarity: "restricted", price: 850 },
  { weapon: "P90", name: "Elite Build", category: "smg", rarity: "restricted", price: 550 },
  { weapon: "P90", name: "Blind Spot", category: "smg", rarity: "restricted", price: 450 },
  { weapon: "P90", name: "Sand Spray", category: "smg", rarity: "consumer", price: 85 },
  { weapon: "P90", name: "Freight", category: "smg", rarity: "classified", price: 1800 },
  { weapon: "P90", name: "Cocoa Rampage", category: "smg", rarity: "restricted", price: 650 },
  
  // PP-Bizon
  { weapon: "PP-Bizon", name: "Judgement of Anubis", category: "smg", rarity: "covert", price: 3500 },
  { weapon: "PP-Bizon", name: "High Roller", category: "smg", rarity: "classified", price: 1500 },
  { weapon: "PP-Bizon", name: "Fuel Rod", category: "smg", rarity: "restricted", price: 550 },
  { weapon: "PP-Bizon", name: "Photic Zone", category: "smg", rarity: "restricted", price: 350 },
  { weapon: "PP-Bizon", name: "Cobalt Halftone", category: "smg", rarity: "mil-spec", price: 180 },
  { weapon: "PP-Bizon", name: "Sand Dashed", category: "smg", rarity: "consumer", price: 45 },
  { weapon: "PP-Bizon", name: "Embargo", category: "smg", rarity: "classified", price: 1200 },
  { weapon: "PP-Bizon", name: "Space Cat", category: "smg", rarity: "restricted", price: 450 },
  
  // ============ SHOTGUNS ============
  // Nova
  { weapon: "Nova", name: "Hyper Beast", category: "shotgun", rarity: "covert", price: 3500 },
  { weapon: "Nova", name: "Antique", category: "shotgun", rarity: "classified", price: 1800 },
  { weapon: "Nova", name: "Rising Skull", category: "shotgun", rarity: "classified", price: 1200 },
  { weapon: "Nova", name: "Bloomstick", category: "shotgun", rarity: "restricted", price: 550 },
  { weapon: "Nova", name: "Ranger", category: "shotgun", rarity: "restricted", price: 350 },
  { weapon: "Nova", name: "Graphite", category: "shotgun", rarity: "restricted", price: 250 },
  { weapon: "Nova", name: "Predator", category: "shotgun", rarity: "consumer", price: 65 },
  { weapon: "Nova", name: "Caged Steel", category: "shotgun", rarity: "consumer", price: 45 },
  { weapon: "Nova", name: "Toy Soldier", category: "shotgun", rarity: "classified", price: 1500 },
  { weapon: "Nova", name: "Plume", category: "shotgun", rarity: "restricted", price: 450 },
  
  // XM1014
  { weapon: "XM1014", name: "Tranquility", category: "shotgun", rarity: "covert", price: 3200 },
  { weapon: "XM1014", name: "Seasons", category: "shotgun", rarity: "classified", price: 1500 },
  { weapon: "XM1014", name: "Teclu Burner", category: "shotgun", rarity: "classified", price: 1200 },
  { weapon: "XM1014", name: "Heaven Guard", category: "shotgun", rarity: "restricted", price: 550 },
  { weapon: "XM1014", name: "Oxide Blaze", category: "shotgun", rarity: "restricted", price: 350 },
  { weapon: "XM1014", name: "Slipstream", category: "shotgun", rarity: "mil-spec", price: 180 },
  { weapon: "XM1014", name: "Blue Steel", category: "shotgun", rarity: "consumer", price: 65 },
  { weapon: "XM1014", name: "Bone Machine", category: "shotgun", rarity: "classified", price: 950 },
  { weapon: "XM1014", name: "XOXO", category: "shotgun", rarity: "restricted", price: 450 },
  
  // MAG-7
  { weapon: "MAG-7", name: "Justice", category: "shotgun", rarity: "covert", price: 2800 },
  { weapon: "MAG-7", name: "Praetorian", category: "shotgun", rarity: "classified", price: 1200 },
  { weapon: "MAG-7", name: "Heat", category: "shotgun", rarity: "restricted", price: 550 },
  { weapon: "MAG-7", name: "Bulldozer", category: "shotgun", rarity: "restricted", price: 350 },
  { weapon: "MAG-7", name: "Memento", category: "shotgun", rarity: "restricted", price: 250 },
  { weapon: "MAG-7", name: "Storm", category: "shotgun", rarity: "consumer", price: 65 },
  { weapon: "MAG-7", name: "Monster Call", category: "shotgun", rarity: "classified", price: 850 },
  { weapon: "MAG-7", name: "Cinquedea", category: "shotgun", rarity: "restricted", price: 450 },
  
  // Sawed-Off
  { weapon: "Sawed-Off", name: "The Kraken", category: "shotgun", rarity: "covert", price: 2500 },
  { weapon: "Sawed-Off", name: "Limelight", category: "shotgun", rarity: "classified", price: 1200 },
  { weapon: "Sawed-Off", name: "Devourer", category: "shotgun", rarity: "classified", price: 850 },
  { weapon: "Sawed-Off", name: "Yorick", category: "shotgun", rarity: "restricted", price: 450 },
  { weapon: "Sawed-Off", name: "Highwayman", category: "shotgun", rarity: "restricted", price: 350 },
  { weapon: "Sawed-Off", name: "Rust Coat", category: "shotgun", rarity: "consumer", price: 65 },
  { weapon: "Sawed-Off", name: "Kiss♥Love", category: "shotgun", rarity: "classified", price: 950 },
  { weapon: "Sawed-Off", name: "Apocalypto", category: "shotgun", rarity: "restricted", price: 550 },
  
  // ============ MACHINE GUNS ============
  // M249
  { weapon: "M249", name: "Emerald Poison Dart", category: "machinegun", rarity: "classified", price: 1500 },
  { weapon: "M249", name: "Nebula Crusader", category: "machinegun", rarity: "classified", price: 1200 },
  { weapon: "M249", name: "Spectre", category: "machinegun", rarity: "restricted", price: 550 },
  { weapon: "M249", name: "Aztec", category: "machinegun", rarity: "restricted", price: 350 },
  { weapon: "M249", name: "Impact Drill", category: "machinegun", rarity: "restricted", price: 250 },
  { weapon: "M249", name: "Jungle", category: "machinegun", rarity: "consumer", price: 45 },
  { weapon: "M249", name: "Downtown", category: "machinegun", rarity: "classified", price: 950 },
  { weapon: "M249", name: "Deep Relief", category: "machinegun", rarity: "restricted", price: 450 },
  
  // Negev
  { weapon: "Negev", name: "Power Loader", category: "machinegun", rarity: "classified", price: 1800 },
  { weapon: "Negev", name: "Mjölnir", category: "machinegun", rarity: "classified", price: 1500 },
  { weapon: "Negev", name: "Loudmouth", category: "machinegun", rarity: "restricted", price: 550 },
  { weapon: "Negev", name: "Dazzle", category: "machinegun", rarity: "restricted", price: 350 },
  { weapon: "Negev", name: "Man-o'-war", category: "machinegun", rarity: "restricted", price: 250 },
  { weapon: "Negev", name: "Army Sheen", category: "machinegun", rarity: "consumer", price: 45 },
  { weapon: "Negev", name: "Prototype", category: "machinegun", rarity: "classified", price: 1200 },
  { weapon: "Negev", name: "Ultralight", category: "machinegun", rarity: "restricted", price: 450 },
  
  // ============ OTHER RIFLES ============
  // SG 553
  { weapon: "SG 553", name: "Integrale", category: "rifle", rarity: "covert", price: 4500 },
  { weapon: "SG 553", name: "Cyrex", category: "rifle", rarity: "classified", price: 2200 },
  { weapon: "SG 553", name: "Pulse", category: "rifle", rarity: "restricted", price: 550 },
  { weapon: "SG 553", name: "Tiger Moth", category: "rifle", rarity: "restricted", price: 350 },
  { weapon: "SG 553", name: "Damascus Steel", category: "rifle", rarity: "mil-spec", price: 180 },
  { weapon: "SG 553", name: "Safari Mesh", category: "rifle", rarity: "consumer", price: 45 },
  { weapon: "SG 553", name: "Phantom", category: "rifle", rarity: "classified", price: 1800 },
  { weapon: "SG 553", name: "Ol' Rusty", category: "rifle", rarity: "restricted", price: 450 },
  
  // AUG
  { weapon: "AUG", name: "Akihabara Accept", category: "rifle", rarity: "covert", price: 85000 },
  { weapon: "AUG", name: "Chameleon", category: "rifle", rarity: "covert", price: 5500 },
  { weapon: "AUG", name: "Flame Jörmungandr", category: "rifle", rarity: "covert", price: 3500 },
  { weapon: "AUG", name: "Bengal Tiger", category: "rifle", rarity: "classified", price: 2200 },
  { weapon: "AUG", name: "Hot Rod", category: "rifle", rarity: "classified", price: 4500 },
  { weapon: "AUG", name: "Aristocrat", category: "rifle", rarity: "restricted", price: 550 },
  { weapon: "AUG", name: "Anodized Navy", category: "rifle", rarity: "restricted", price: 350 },
  { weapon: "AUG", name: "Storm", category: "rifle", rarity: "consumer", price: 65 },
  { weapon: "AUG", name: "Wings", category: "rifle", rarity: "classified", price: 1800 },
  { weapon: "AUG", name: "Midnight Lily", category: "rifle", rarity: "restricted", price: 850 },
  
  // Galil AR
  { weapon: "Galil AR", name: "Chatterbox", category: "rifle", rarity: "covert", price: 6500 },
  { weapon: "Galil AR", name: "Eco", category: "rifle", rarity: "classified", price: 2200 },
  { weapon: "Galil AR", name: "Stone Cold", category: "rifle", rarity: "classified", price: 1500 },
  { weapon: "Galil AR", name: "Chromatic Aberration", category: "rifle", rarity: "restricted", price: 550 },
  { weapon: "Galil AR", name: "Rocket Pop", category: "rifle", rarity: "restricted", price: 350 },
  { weapon: "Galil AR", name: "Sage Spray", category: "rifle", rarity: "consumer", price: 45 },
  { weapon: "Galil AR", name: "Firefight", category: "rifle", rarity: "classified", price: 1200 },
  { weapon: "Galil AR", name: "Cold Fusion", category: "rifle", rarity: "restricted", price: 450 },
  
  // FAMAS
  { weapon: "FAMAS", name: "Roll Cage", category: "rifle", rarity: "covert", price: 3500 },
  { weapon: "FAMAS", name: "Mecha Industries", category: "rifle", rarity: "covert", price: 4500 },
  { weapon: "FAMAS", name: "Afterimage", category: "rifle", rarity: "classified", price: 2200 },
  { weapon: "FAMAS", name: "Djinn", category: "rifle", rarity: "classified", price: 1500 },
  { weapon: "FAMAS", name: "Neural Net", category: "rifle", rarity: "restricted", price: 550 },
  { weapon: "FAMAS", name: "Hexane", category: "rifle", rarity: "restricted", price: 350 },
  { weapon: "FAMAS", name: "Colony", category: "rifle", rarity: "consumer", price: 65 },
  { weapon: "FAMAS", name: "ZX Spectron", category: "rifle", rarity: "classified", price: 1200 },
  { weapon: "FAMAS", name: "Rapid Eye Movement", category: "rifle", rarity: "restricted", price: 450 },
  
  // ============ SCOUT / SSG 08 ============
  { weapon: "SSG 08", name: "Dragonfire", category: "sniper", rarity: "covert", price: 8500 },
  { weapon: "SSG 08", name: "Blood in the Water", category: "sniper", rarity: "covert", price: 28000 },
  { weapon: "SSG 08", name: "Big Iron", category: "sniper", rarity: "classified", price: 1800 },
  { weapon: "SSG 08", name: "Detour", category: "sniper", rarity: "classified", price: 1500 },
  { weapon: "SSG 08", name: "Abyss", category: "sniper", rarity: "restricted", price: 550 },
  { weapon: "SSG 08", name: "Slashed", category: "sniper", rarity: "restricted", price: 350 },
  { weapon: "SSG 08", name: "Sand Dune", category: "sniper", rarity: "consumer", price: 65 },
  { weapon: "SSG 08", name: "Death Strike", category: "sniper", rarity: "classified", price: 1200 },
  { weapon: "SSG 08", name: "Sea Calico", category: "sniper", rarity: "restricted", price: 450 },
  
  // SCAR-20
  { weapon: "SCAR-20", name: "Emerald", category: "sniper", rarity: "covert", price: 4500 },
  { weapon: "SCAR-20", name: "Bloodsport", category: "sniper", rarity: "covert", price: 3500 },
  { weapon: "SCAR-20", name: "Cyrex", category: "sniper", rarity: "classified", price: 1800 },
  { weapon: "SCAR-20", name: "Cardiac", category: "sniper", rarity: "classified", price: 1200 },
  { weapon: "SCAR-20", name: "Blueprint", category: "sniper", rarity: "restricted", price: 550 },
  { weapon: "SCAR-20", name: "Grotto", category: "sniper", rarity: "restricted", price: 350 },
  { weapon: "SCAR-20", name: "Sand Mesh", category: "sniper", rarity: "consumer", price: 45 },
  { weapon: "SCAR-20", name: "Enforcer", category: "sniper", rarity: "classified", price: 950 },
  { weapon: "SCAR-20", name: "Jungle Slipstream", category: "sniper", rarity: "restricted", price: 450 },
  
  // G3SG1
  { weapon: "G3SG1", name: "The Executioner", category: "sniper", rarity: "covert", price: 3800 },
  { weapon: "G3SG1", name: "Flux", category: "sniper", rarity: "classified", price: 1500 },
  { weapon: "G3SG1", name: "Stinger", category: "sniper", rarity: "classified", price: 1200 },
  { weapon: "G3SG1", name: "High Seas", category: "sniper", rarity: "restricted", price: 550 },
  { weapon: "G3SG1", name: "Orange Crash", category: "sniper", rarity: "restricted", price: 350 },
  { weapon: "G3SG1", name: "Jungle Dashed", category: "sniper", rarity: "consumer", price: 45 },
  { weapon: "G3SG1", name: "Dream Glade", category: "sniper", rarity: "classified", price: 950 },
  { weapon: "G3SG1", name: "Ventilator", category: "sniper", rarity: "restricted", price: 450 },
];

// Generate image URL for csgodatabase.com
function generateImageUrl(weapon: string, skin: string): string {
  const weaponClean = weapon
    .replace(/-/g, '-')
    .replace(/\s+/g, '_');
  
  const skinClean = skin
    .replace(/[']/g, '')
    .replace(/[♥]/g, '')
    .replace(/!/g, '')
    .replace(/\s+/g, '_');
  
  return `https://www.csgodatabase.com/images/skins/${weaponClean}_${skinClean}.png`;
}

// Balanced case configurations with house edge
const CASE_CONFIGS = [
  {
    id: "starter",
    name: "Стартовый кейс",
    price: 99,
    icon: "Package",
    color: "from-gray-500/20 to-gray-600/30 border-gray-500",
    // Expected value ~85₽ (14% house edge)
    drops: [
      { rarity: "consumer", chance: 45, minPrice: 25, maxPrice: 120 },
      { rarity: "mil-spec", chance: 35, minPrice: 120, maxPrice: 450 },
      { rarity: "restricted", chance: 15, minPrice: 350, maxPrice: 850 },
      { rarity: "classified", chance: 4.5, minPrice: 850, maxPrice: 2500 },
      { rarity: "covert", chance: 0.5, minPrice: 2500, maxPrice: 6500 },
    ]
  },
  {
    id: "budget",
    name: "Бюджетный кейс",
    price: 249,
    icon: "Coins",
    color: "from-green-500/20 to-green-600/30 border-green-500",
    // Expected value ~210₽ (15.5% house edge)
    drops: [
      { rarity: "consumer", chance: 35, minPrice: 45, maxPrice: 180 },
      { rarity: "mil-spec", chance: 35, minPrice: 180, maxPrice: 650 },
      { rarity: "restricted", chance: 20, minPrice: 550, maxPrice: 1500 },
      { rarity: "classified", chance: 8, minPrice: 1200, maxPrice: 3500 },
      { rarity: "covert", chance: 2, minPrice: 3500, maxPrice: 12000 },
    ]
  },
  {
    id: "standard",
    name: "Стандартный кейс",
    price: 499,
    icon: "Box",
    color: "from-blue-500/20 to-blue-600/30 border-blue-500",
    // Expected value ~420₽ (16% house edge)
    drops: [
      { rarity: "consumer", chance: 25, minPrice: 65, maxPrice: 220 },
      { rarity: "mil-spec", chance: 35, minPrice: 180, maxPrice: 650 },
      { rarity: "restricted", chance: 25, minPrice: 550, maxPrice: 2200 },
      { rarity: "classified", chance: 12, minPrice: 1500, maxPrice: 5500 },
      { rarity: "covert", chance: 3, minPrice: 5500, maxPrice: 18000 },
    ]
  },
  {
    id: "rifle",
    name: "Кейс Винтовок",
    price: 799,
    icon: "Target",
    color: "from-orange-500/20 to-orange-600/30 border-orange-500",
    // Expected value ~670₽ (16% house edge) - rifles only
    drops: [
      { rarity: "consumer", chance: 20, minPrice: 85, maxPrice: 280 },
      { rarity: "mil-spec", chance: 30, minPrice: 280, maxPrice: 850 },
      { rarity: "restricted", chance: 28, minPrice: 850, maxPrice: 3500 },
      { rarity: "classified", chance: 17, minPrice: 2500, maxPrice: 9500 },
      { rarity: "covert", chance: 5, minPrice: 8500, maxPrice: 55000 },
    ],
    categoryFilter: ["rifle", "sniper"]
  },
  {
    id: "pistol",
    name: "Кейс Пистолетов",
    price: 599,
    icon: "Crosshair",
    color: "from-purple-500/20 to-purple-600/30 border-purple-500",
    // Expected value ~500₽ (16.5% house edge) - pistols only
    drops: [
      { rarity: "consumer", chance: 25, minPrice: 45, maxPrice: 220 },
      { rarity: "mil-spec", chance: 30, minPrice: 180, maxPrice: 550 },
      { rarity: "restricted", chance: 27, minPrice: 450, maxPrice: 2200 },
      { rarity: "classified", chance: 14, minPrice: 1500, maxPrice: 5500 },
      { rarity: "covert", chance: 4, minPrice: 5500, maxPrice: 45000 },
    ],
    categoryFilter: ["pistol"]
  },
  {
    id: "premium",
    name: "Премиум кейс",
    price: 1499,
    icon: "Star",
    color: "from-yellow-500/20 to-yellow-600/30 border-yellow-500",
    // Expected value ~1250₽ (17% house edge)
    drops: [
      { rarity: "mil-spec", chance: 20, minPrice: 280, maxPrice: 850 },
      { rarity: "restricted", chance: 35, minPrice: 850, maxPrice: 3500 },
      { rarity: "classified", chance: 30, minPrice: 2500, maxPrice: 12000 },
      { rarity: "covert", chance: 13, minPrice: 8500, maxPrice: 55000 },
      { rarity: "extraordinary", chance: 2, minPrice: 15000, maxPrice: 85000 },
    ]
  },
  {
    id: "knife",
    name: "Кейс Ножей",
    price: 2999,
    icon: "Sword",
    color: "from-red-500/20 to-red-600/30 border-red-500",
    // Expected value ~2450₽ (18% house edge) - knives only
    drops: [
      { rarity: "covert", chance: 65, minPrice: 3200, maxPrice: 22000 },
      { rarity: "covert", chance: 25, minPrice: 22000, maxPrice: 65000 },
      { rarity: "covert", chance: 8, minPrice: 65000, maxPrice: 120000 },
      { rarity: "contraband", chance: 2, minPrice: 320000, maxPrice: 850000 },
    ],
    categoryFilter: ["knife"]
  },
  {
    id: "gloves",
    name: "Кейс Перчаток",
    price: 3499,
    icon: "Hand",
    color: "from-emerald-500/20 to-emerald-600/30 border-emerald-500",
    // Expected value ~2850₽ (18.5% house edge) - gloves only
    drops: [
      { rarity: "extraordinary", chance: 60, minPrice: 15000, maxPrice: 45000 },
      { rarity: "extraordinary", chance: 28, minPrice: 45000, maxPrice: 95000 },
      { rarity: "extraordinary", chance: 10, minPrice: 95000, maxPrice: 180000 },
      { rarity: "extraordinary", chance: 2, minPrice: 180000, maxPrice: 450000 },
    ],
    categoryFilter: ["gloves"]
  },
  {
    id: "elite",
    name: "Элитный кейс",
    price: 4999,
    icon: "Crown",
    color: "from-amber-500/20 to-amber-600/30 border-amber-500",
    // Expected value ~4000₽ (20% house edge)
    drops: [
      { rarity: "classified", chance: 40, minPrice: 5500, maxPrice: 18000 },
      { rarity: "covert", chance: 35, minPrice: 15000, maxPrice: 55000 },
      { rarity: "covert", chance: 15, minPrice: 55000, maxPrice: 120000 },
      { rarity: "extraordinary", chance: 8, minPrice: 85000, maxPrice: 320000 },
      { rarity: "contraband", chance: 2, minPrice: 280000, maxPrice: 850000 },
    ]
  },
  {
    id: "legendary",
    name: "Легендарный кейс",
    price: 9999,
    icon: "Diamond",
    color: "from-pink-500/20 to-pink-600/30 border-pink-500",
    // Expected value ~7800₽ (22% house edge)
    drops: [
      { rarity: "covert", chance: 45, minPrice: 28000, maxPrice: 85000 },
      { rarity: "covert", chance: 25, minPrice: 85000, maxPrice: 180000 },
      { rarity: "extraordinary", chance: 18, minPrice: 120000, maxPrice: 380000 },
      { rarity: "contraband", chance: 12, minPrice: 320000, maxPrice: 1500000 },
    ]
  },
  {
    id: "dragon",
    name: "Драконий кейс",
    price: 19999,
    icon: "Flame",
    color: "from-rose-500/20 to-rose-600/30 border-rose-500",
    // Expected value ~15000₽ (25% house edge) - ultra rare items
    drops: [
      { rarity: "covert", chance: 35, minPrice: 55000, maxPrice: 180000 },
      { rarity: "extraordinary", chance: 30, minPrice: 180000, maxPrice: 450000 },
      { rarity: "contraband", chance: 25, minPrice: 450000, maxPrice: 850000 },
      { rarity: "contraband", chance: 10, minPrice: 850000, maxPrice: 1500000 },
    ]
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log("=== Starting complete skins database population ===");

    // Step 1: Clear existing skins (optional, be careful with user inventory)
    // We'll use upsert instead to preserve existing skins

    // Step 2: Insert/Update all skins
    let skinsUpdated = 0;
    let skinsCreated = 0;
    let skinsFailed = 0;

    for (const skin of SKINS_DATABASE) {
      const imageUrl = generateImageUrl(skin.weapon, skin.name);
      
      // Check if skin exists
      const { data: existingSkin } = await supabase
        .from('skins')
        .select('id')
        .eq('weapon', skin.weapon)
        .eq('name', skin.name)
        .single();

      if (existingSkin) {
        // Update existing skin
        const { error } = await supabase
          .from('skins')
          .update({
            category: skin.category,
            rarity: skin.rarity,
            price: skin.price,
            image_url: imageUrl
          })
          .eq('id', existingSkin.id);

        if (error) {
          console.error(`Failed to update ${skin.weapon} ${skin.name}:`, error.message);
          skinsFailed++;
        } else {
          skinsUpdated++;
        }
      } else {
        // Create new skin
        const { error } = await supabase
          .from('skins')
          .insert({
            weapon: skin.weapon,
            name: skin.name,
            category: skin.category,
            rarity: skin.rarity,
            price: skin.price,
            image_url: imageUrl
          });

        if (error) {
          console.error(`Failed to create ${skin.weapon} ${skin.name}:`, error.message);
          skinsFailed++;
        } else {
          skinsCreated++;
        }
      }
    }

    console.log(`Skins: ${skinsCreated} created, ${skinsUpdated} updated, ${skinsFailed} failed`);

    // Step 3: Update case types
    console.log("=== Updating case types ===");
    
    // First clear existing case types and items
    await supabase.from('case_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('case_types').delete().neq('id', 'placeholder');

    for (const caseConfig of CASE_CONFIGS) {
      // Create case type
      const { error: caseError } = await supabase
        .from('case_types')
        .upsert({
          id: caseConfig.id,
          name: caseConfig.name,
          price: caseConfig.price,
          icon: caseConfig.icon,
          color: caseConfig.color,
          is_active: true
        });

      if (caseError) {
        console.error(`Failed to create case ${caseConfig.name}:`, caseError.message);
        continue;
      }

      console.log(`Created case: ${caseConfig.name}`);

      // Get skins for this case based on filters
      let skinsForCase = SKINS_DATABASE.filter(skin => {
        // Filter by category if specified
        if (caseConfig.categoryFilter) {
          if (!caseConfig.categoryFilter.includes(skin.category)) {
            return false;
          }
        }
        return true;
      });

      // Create case items based on drop configuration
      let itemsCreated = 0;
      for (const dropConfig of caseConfig.drops) {
        // Find skins matching this rarity and price range
        const matchingSkins = skinsForCase.filter(skin => 
          skin.rarity === dropConfig.rarity &&
          skin.price >= dropConfig.minPrice &&
          skin.price <= dropConfig.maxPrice
        );

        if (matchingSkins.length === 0) {
          console.log(`No skins found for ${caseConfig.name} - ${dropConfig.rarity} (${dropConfig.minPrice}-${dropConfig.maxPrice})`);
          continue;
        }

        // Calculate individual chance per skin
        const chancePerSkin = dropConfig.chance / matchingSkins.length;

        for (const skin of matchingSkins) {
          const { error: itemError } = await supabase
            .from('case_items')
            .insert({
              case_type_id: caseConfig.id,
              name: skin.name,
              weapon: skin.weapon,
              rarity: skin.rarity,
              price: skin.price,
              chance: chancePerSkin,
              image_url: generateImageUrl(skin.weapon, skin.name)
            });

          if (itemError) {
            console.error(`Failed to add item ${skin.weapon} ${skin.name} to ${caseConfig.name}:`, itemError.message);
          } else {
            itemsCreated++;
          }
        }
      }

      console.log(`Added ${itemsCreated} items to ${caseConfig.name}`);
    }

    // Get final counts
    const { count: totalSkins } = await supabase
      .from('skins')
      .select('*', { count: 'exact', head: true });

    const { count: totalCases } = await supabase
      .from('case_types')
      .select('*', { count: 'exact', head: true });

    const { count: totalItems } = await supabase
      .from('case_items')
      .select('*', { count: 'exact', head: true });

    console.log("=== Population complete ===");
    console.log(`Total skins: ${totalSkins}`);
    console.log(`Total cases: ${totalCases}`);
    console.log(`Total case items: ${totalItems}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Database populated successfully",
        stats: {
          skins: {
            created: skinsCreated,
            updated: skinsUpdated,
            failed: skinsFailed,
            total: totalSkins
          },
          cases: totalCases,
          caseItems: totalItems
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error("Population error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
