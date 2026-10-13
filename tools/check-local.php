<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/scans/common.php';
require_once __DIR__.'/../api/scans/tripo-common.php';
try{
 foreach(['pdo_mysql','curl','gd'] as $extension)if(!extension_loaded($extension))throw new RuntimeException('PHP extension missing: '.$extension);
 try{getDb()->query('SELECT id FROM scan_jobs LIMIT 1');}catch(Throwable $error){throw new RuntimeException('MySQL unavailable or scan tables missing. Start MySQL in XAMPP; check api/.env.');}
 try{getDb()->query('SELECT checkout_request_id,checkout_request_hash FROM reservations LIMIT 1');}catch(Throwable $error){throw new RuntimeException('Apply api/database/checkout-retries.sql to the configured database before starting checkout.');}
 echo "MySQL and scan queue ready.\n";
 if(!is_writable(scanRoot()))throw new RuntimeException('Private scan storage is not writable.');
 if(!is_file((string)configValue('BLENDER_EXE')))throw new RuntimeException('Blender unavailable. Check BLENDER_EXE in api/.env.');
 if(!tripoConfigured())throw new RuntimeException('Tripo API key or PHP cURL unavailable. Check local configuration.');
 echo "Private storage, Blender, and Tripo configuration ready (no credits spent).\n";
 echo is_file((string)configValue('REALITYSCAN_EXE'))?"Local AI masking available.\n":"Local AI masking unavailable; Tripo can still use original photos.\n";
}catch(Throwable $error){fwrite(STDERR,$error->getMessage()."\n");exit(1);}
