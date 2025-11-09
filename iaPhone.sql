/*
  IA-Phone - Database Schema (MySQL/MariaDB)
  Minimal features: Users, Contacts, Conversations, Messages, Call History
  Charset: utf8mb4 (emoji-safe)
  Safe to run multiple times: drops then recreates tables

  FR: Ce script crée la base pour IA-Phone: utilisateurs, contacts, SMS (conversations/messages) et historiques d'appels.
  EN: This script sets up IA-Phone core tables: users, contacts, SMS (conversations/messages) and call histories.
*/

-- table utilisateurs (si tu ne l'as pas déjà)
CREATE TABLE IF NOT EXISTS iaPhone_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  citizenid VARCHAR(128) NOT NULL,        -- ton identifiant technique (char id)
  name VARCHAR(100) NOT NULL,             -- Jordan Lee (label)
  phone_number VARCHAR(32) UNIQUE,        -- format libre mais unique (ex: 514-555-0123)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- table messages (simple, efficace)
CREATE TABLE IF NOT EXISTS iaPhone_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_phone VARCHAR(32) NOT NULL,       -- le phone_number du propriétaire (ex: Jordan Lee)
  contact_phone VARCHAR(32) NOT NULL,     -- le phone number du contact (ou group id)
  contact_name VARCHAR(100) DEFAULT NULL, -- label du contact (affichage)
  direction ENUM('me','them') NOT NULL,   -- 'me' = envoyé par owner, 'them' = reçu
  text TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  seen TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_owner_phone (owner_phone),
  INDEX idx_contact_phone (contact_phone),
  INDEX idx_owner_created (owner_phone, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
