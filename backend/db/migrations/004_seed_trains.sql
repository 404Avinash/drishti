-- 004_seed_trains.sql
-- Seeds 20 real Indian Railway trains + 15 key junction stations.
-- Safe to run multiple times: uses INSERT ... ON CONFLICT DO NOTHING.

-- ── Stations ─────────────────────────────────────────────────────────────────
INSERT INTO stations (code, name, zone, latitude, longitude, is_junction, platform_count)
VALUES
  ('NDLS',  'New Delhi',         'NR',   28.6431,  77.2197, true,  16),
  ('HWH',   'Howrah Junction',   'ER',   22.5958,  88.3017, true,  23),
  ('CSTM',  'Mumbai CSMT',       'CR',   18.9400,  72.8347, true,  18),
  ('MAS',   'Chennai Central',   'SR',   13.0288,  80.1859, true,  12),
  ('SC',    'Secunderabad Jn',   'SCR',  17.4337,  78.5016, true,  10),
  ('SBC',   'Bangalore City',    'SWR',  12.9565,  77.5960, true,   8),
  ('NGP',   'Nagpur Junction',   'CR',   21.1460,  79.0882, true,   8),
  ('ALD',   'Prayagraj Jn',      'NCR',  25.4246,  81.8410, true,  10),
  ('BPL',   'Bhopal Junction',   'WCR',  23.1815,  77.4104, true,   6),
  ('LKO',   'Lucknow Jn',        'NR',   26.8390,  80.9333, true,   8),
  ('BZA',   'Vijayawada Jn',     'SCR',  16.5062,  80.6480, true,  10),
  ('ADI',   'Ahmedabad Jn',      'WR',   23.0225,  72.5714, true,   8),
  ('PNBE',  'Patna Junction',    'ECR',  25.6022,  85.1376, true,   5),
  ('GHY',   'Guwahati',          'NFR',  26.1445,  91.7362, true,   4),
  ('JP',    'Jaipur Junction',   'NWR',  26.9196,  75.7887, true,   6)
ON CONFLICT (code) DO NOTHING;

-- ── Trains ───────────────────────────────────────────────────────────────────
INSERT INTO trains (train_id, train_name, source, destination, route, is_active, current_station_code)
VALUES
  ('12001', 'New Bhopal Shatabdi',      'NTES', 'BPL',  'NDLS-BPL',   true, 'NDLS'),
  ('12002', 'Bhopal Shatabdi',          'NTES', 'NDLS', 'BPL-NDLS',   true, 'BPL'),
  ('12301', 'Howrah Rajdhani Express',  'NTES', 'NDLS', 'HWH-NDLS',   true, 'ALD'),
  ('12302', 'New Delhi Rajdhani',       'NTES', 'HWH',  'NDLS-HWH',   true, 'NGP'),
  ('12309', 'Rajendra Nagar Rajdhani',  'NTES', 'NDLS', 'PNBE-NDLS',  true, 'LKO'),
  ('12622', 'Tamil Nadu SF Express',    'NTES', 'MAS',  'NDLS-MAS',   true, 'SC'),
  ('12627', 'Karnataka Express',        'NTES', 'SBC',  'NDLS-SBC',   true, 'NGP'),
  ('12723', 'Telangana Express',        'NTES', 'SC',   'NDLS-SC',    true, 'BPL'),
  ('12801', 'Purushottam SF Express',   'NTES', 'NDLS', 'CSTM-NDLS',  true, 'NGP'),
  ('12841', 'Coromandel Express',       'NTES', 'MAS',  'HWH-MAS',    true, 'BZA'),
  ('12951', 'Mumbai Rajdhani Express',  'NTES', 'NDLS', 'CSTM-NDLS',  true, 'ADI'),
  ('12952', 'New Delhi Rajdhani',       'NTES', 'CSTM', 'NDLS-CSTM',  true, 'BPL'),
  ('13015', 'Kaviguru Express',         'NTES', 'GHY',  'NDLS-GHY',   true, 'ALD'),
  ('20503', 'Agartala Rajdhani',        'NTES', 'GHY',  'NDLS-GHY',   true, 'PNBE'),
  ('12275', 'Duronto Express',          'NTES', 'NDLS', 'HWH-NDLS',   true, 'HWH'),
  ('12559', 'Shiv Ganga Express',       'NTES', 'NDLS', 'MAS-NDLS',   true, 'LKO'),
  ('22221', 'CSMT Rajdhani Express',    'NTES', 'NDLS', 'CSTM-NDLS',  true, 'NGP'),
  ('12003', 'Lucknow Shatabdi',         'NTES', 'LKO',  'NDLS-LKO',   true, 'NDLS'),
  ('12004', 'New Delhi Shatabdi',       'NTES', 'NDLS', 'LKO-NDLS',   true, 'LKO'),
  ('12423', 'Dibrugarh Rajdhani',       'NTES', 'GHY',  'NDLS-GHY',   true, 'PNBE')
ON CONFLICT (train_id) DO NOTHING;
