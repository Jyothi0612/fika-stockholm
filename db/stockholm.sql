-- Demo data for the delivery service: Stockholm districts with an approximate centre point.
-- Real district names and postcode areas; the coordinates are rounded, the fees in the app are illustrative.
-- Safe to run again: it recreates the table.
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS stockholm CHARACTER SET utf8mb4 COLLATE utf8mb4_sv_0900_ai_ci;
USE stockholm;

DROP TABLE IF EXISTS districts;
CREATE TABLE districts (
  id       INT PRIMARY KEY,
  name     VARCHAR(64) NOT NULL,
  postcode VARCHAR(8)  NOT NULL,
  lat      DOUBLE      NOT NULL,
  lon      DOUBLE      NOT NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_sv_0900_ai_ci;

INSERT INTO districts (id, name, postcode, lat, lon) VALUES
  (1,  'Södermalm',        '118', 59.3150, 18.0710),
  (2,  'Gamla stan',       '111', 59.3251, 18.0711),
  (3,  'Norrmalm',         '111', 59.3340, 18.0600),
  (4,  'Vasastan',         '113', 59.3440, 18.0460),
  (5,  'Östermalm',        '114', 59.3380, 18.0850),
  (6,  'Kungsholmen',      '112', 59.3330, 18.0270),
  (7,  'Djurgården',       '115', 59.3260, 18.1150),
  (8,  'Hammarby sjöstad', '120', 59.3040, 18.1020),
  (9,  'Hornstull',        '117', 59.3157, 18.0340),
  (10, 'Liljeholmen',      '117', 59.3100, 18.0230),
  (11, 'Solna',            '169', 59.3600, 18.0000),
  (12, 'Sundbyberg',       '172', 59.3610, 17.9720),
  (13, 'Bromma',           '168', 59.3380, 17.9400),
  (14, 'Hägersten',        '129', 59.3000, 17.9800),
  (15, 'Årsta',            '120', 59.2990, 18.0480),
  (16, 'Johanneshov',      '121', 59.2950, 18.0800),
  (17, 'Gärdet',           '115', 59.3470, 18.1000),
  (18, 'Lidingö',          '181', 59.3660, 18.1500),
  (19, 'Nacka',            '131', 59.3100, 18.1640),
  (20, 'Kista',            '164', 59.4030, 17.9440);
