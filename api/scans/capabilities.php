<?php
require_once __DIR__.'/common.php';
scanRequest('GET',function(int $owner) {
    jsonResponse(['tripo'=>tripoConfigured(),'tripoCredits'=>TRIPO_SCAN_CREDITS,'realityscan'=>is_file((string)configValue('REALITYSCAN_EXE')) && is_file((string)configValue('BLENDER_EXE'))]);
});
