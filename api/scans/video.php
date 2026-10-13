<?php
require_once __DIR__.'/common.php';
scanRequest('POST',function(int $owner){scanFail('Video scanning is retired. Use 1-4 reference photos with AI generation.',410);});
