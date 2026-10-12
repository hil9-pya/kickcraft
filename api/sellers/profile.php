<?php
require_once __DIR__.'/common.php';
sellerRequest('GET',fn($user)=>jsonResponse(['seller'=>sellerProfile((int)$user['id'])]),'account');
