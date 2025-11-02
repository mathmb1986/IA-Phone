/*
  IA-Phone - Database Schema (MySQL/MariaDB)
  Minimal features: Users, Contacts, Conversations, Messages, Call History
  Charset: utf8mb4 (emoji-safe)
  Safe to run multiple times: drops then recreates tables

  FR: Ce script crée la base pour IA-Phone: utilisateurs, contacts, SMS (conversations/messages) et historiques d'appels.
  EN: This script sets up IA-Phone core tables: users, contacts, SMS (conversations/messages) and call histories.
*/

-- Safety/session setup
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET sql_notes = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- DROP in dependency order
-- =====================================================================
DROP TRIGGER IF EXISTS trg_ia_messages_ai_u_conversations_updated;
DROP TABLE IF EXISTS ia_calls_histories;
DROP TABLE IF EXISTS ia_conversation_messages;
DROP TABLE IF EXISTS ia_conversation_participants;
DROP TABLE IF EXISTS ia_conversations;
DROP TABLE IF EXISTS ia_contacts;
DROP TABLE IF EXISTS ia_users;
DROP TABLE IF EXISTS ia_schema;

-- =====================================================================
-- Schema versioning (optional but recommended)
-- =====================================================================
CREATE TABLE ia_schema (
  version        INT NOT NULL,
  applied_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

INSERT INTO ia_schema (version) VALUES (1);

-- =====================================================================
-- Users
-- citizenid: QBCore/ESX identifier (license/citizenid). Use what you store server-side.
-- phone_number: unique player phone number (e.g., '555-1234' or any format you choose)
-- =====================================================================
CREATE TABLE ia_users (
  citizenid                VARCHAR(64)  NOT NULL,
  name                     VARCHAR(100) NOT NULL DEFAULT '',
  phone_number             VARCHAR(20)  NOT NULL,
  avatar                   VARCHAR(255) NOT NULL DEFAULT 'https://i.ibb.co.com/F3w0F5L/default-avatar-1.png',
  wallpaper                VARCHAR(255) NOT NULL DEFAULT 'https://i.ibb.co.com/pftZvpY/peakpx-1.jpg',
  is_anonim                TINYINT(1)   NOT NULL DEFAULT 0,
  is_donot_disturb         TINYINT(1)   NOT NULL DEFAULT 0,
  unread_message           INT          NOT NULL DEFAULT 0,
  unread_message_service   INT          NOT NULL DEFAULT 0,
  created_at               DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (citizenid),
  UNIQUE KEY uk_users_phone (phone_number),
  KEY idx_users_last_seen (last_seen)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

-- =====================================================================
-- Contacts
-- Each row is a saved entry in the owner's phonebook.
-- contact_citizenid can be NULL if the contact is an external number (NPC/service).
-- Enforce uniqueness per owner: (owner, number) unique.
-- =====================================================================
CREATE TABLE ia_contacts (
  id                 INT NOT NULL AUTO_INCREMENT,
  owner_citizenid    VARCHAR(64)  NOT NULL,
  contact_citizenid  VARCHAR(64)  NULL,
  contact_name       VARCHAR(100) NOT NULL,
  contact_number     VARCHAR(20)  NOT NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_contacts_owner
    FOREIGN KEY (owner_citizenid) REFERENCES ia_users(citizenid)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_contacts_contact_user
    FOREIGN KEY (contact_citizenid) REFERENCES ia_users(citizenid)
    ON DELETE SET NULL ON UPDATE CASCADE,
  UNIQUE KEY uk_owner_number (owner_citizenid, contact_number),
  KEY idx_owner_name (owner_citizenid, contact_name),
  KEY idx_contact_citizenid (contact_citizenid)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

-- =====================================================================
-- Conversations
-- is_group=0 for 1:1 conversations, is_group=1 for groups.
-- name can be null for 1:1; set when group.
-- updated_at maintained by trigger on messages.
-- =====================================================================
CREATE TABLE ia_conversations (
  id               INT NOT NULL AUTO_INCREMENT,
  is_group         TINYINT(1) NOT NULL DEFAULT 0,
  name             VARCHAR(100) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_updated (updated_at),
  KEY idx_is_group (is_group)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

-- =====================================================================
-- Conversation participants
-- Composite PK guarantees no duplicate membership.
-- =====================================================================
CREATE TABLE ia_conversation_participants (
  conversationid   INT NOT NULL,
  citizenid        VARCHAR(64) NOT NULL,
  joined_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversationid, citizenid),
  CONSTRAINT fk_participants_conversation
    FOREIGN KEY (conversationid) REFERENCES ia_conversations(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_participants_user
    FOREIGN KEY (citizenid) REFERENCES ia_users(citizenid)
    ON DELETE CASCADE ON UPDATE CASCADE,
  KEY idx_citizenid (citizenid)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

-- =====================================================================
-- Messages
-- status: 0=sent, 1=delivered, 2=read (adjust in code)
-- is_deleted is soft-delete at message-level (optional UI behavior)
-- sender_citizenid can be NULL for system messages (e.g., services)
-- =====================================================================
CREATE TABLE ia_conversation_messages (
  id                 INT NOT NULL AUTO_INCREMENT,
  conversationid     INT NOT NULL,
  sender_citizenid   VARCHAR(64) NULL,
  sender_number      VARCHAR(20) NULL,
  content            TEXT NOT NULL,
  media              TEXT NULL,
  status             TINYINT NOT NULL DEFAULT 0,
  is_deleted         TINYINT(1) NOT NULL DEFAULT 0,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversationid) REFERENCES ia_conversations(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_messages_sender_user
    FOREIGN KEY (sender_citizenid) REFERENCES ia_users(citizenid)
    ON DELETE SET NULL ON UPDATE CASCADE,
  KEY idx_conv_created (conversationid, created_at),
  KEY idx_sender (sender_citizenid),
  FULLTEXT KEY ft_content (content) -- optional: remove if your MySQL doesn't support InnoDB FT
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

-- Keep conversation "updated_at" fresh whenever a message is inserted
DELIMITER $$
CREATE TRIGGER trg_ia_messages_ai_u_conversations_updated
AFTER INSERT ON ia_conversation_messages
FOR EACH ROW
BEGIN
  UPDATE ia_conversations
     SET updated_at = NOW()
   WHERE id = NEW.conversationid;
END$$
DELIMITER ;

-- =====================================================================
-- Calls history
-- flag: 'IN' (incoming), 'OUT' (outgoing), 'MISSED' (missed)
-- is_anonim: hide caller id
-- to_citizenid can be NULL if calling an external number; store in to_number
-- =====================================================================
CREATE TABLE ia_calls_histories (
  id               INT NOT NULL AUTO_INCREMENT,
  from_citizenid   VARCHAR(64) NOT NULL,
  to_citizenid     VARCHAR(64) NULL,
  to_number        VARCHAR(20) NULL,
  flag             VARCHAR(10) NOT NULL DEFAULT 'IN',
  is_anonim        TINYINT(1)  NOT NULL DEFAULT 0,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_calls_from_user
    FOREIGN KEY (from_citizenid) REFERENCES ia_users(citizenid)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_calls_to_user
    FOREIGN KEY (to_citizenid) REFERENCES ia_users(citizenid)
    ON DELETE SET NULL ON UPDATE CASCADE,
  KEY idx_from (from_citizenid, created_at),
  KEY idx_to (to_citizenid, created_at),
  KEY idx_flag (flag)
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci;

-- =====================================================================
-- Seed helper (optional) - comment out if not needed
-- INSERT INTO ia_users (citizenid, name, phone_number) VALUES
--   ('test_citizen_1', 'John Doe', '555-1001'),
--   ('test_citizen_2', 'Jane Roe', '555-1002');

-- Example 1: 1:1 conversation between two users
-- INSERT INTO ia_conversations (is_group, name) VALUES (0, NULL);
-- SET @conv := LAST_INSERT_ID();
-- INSERT INTO ia_conversation_participants (conversationid, citizenid)
--   VALUES (@conv, 'test_citizen_1'), (@conv, 'test_citizen_2');

-- INSERT INTO ia_conversation_messages (conversationid, sender_citizenid, sender_number, content)
--   VALUES (@conv, 'test_citizen_1', '555-1001', 'Hello there!');

-- Example 2: Contact book
-- INSERT INTO ia_contacts (owner_citizenid, contact_citizenid, contact_name, contact_number)
--   VALUES ('test_citizen_1', 'test_citizen_2', 'Jane', '555-1002');

SET FOREIGN_KEY_CHECKS = 1;
SET sql_notes = 1;
