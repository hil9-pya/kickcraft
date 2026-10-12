import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,copyFileSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
test('PHP configuration stays request-local when another Apache request changes the process environment',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-config-'))
 try {
  copyFileSync(new URL('../api/config.php',import.meta.url),path.join(dir,'config.php'))
  writeFileSync(path.join(dir,'.env'),'DB_NAME=scan_fixture\nSESSION_NAME=KC_CONFIG_TEST\n')
  const script=`putenv('DB_NAME=other_app'); require ${JSON.stringify(path.join(dir,'config.php'))}; $processBefore=getenv('DB_NAME'); putenv('DB_NAME=other_request'); echo json_encode([configValue('DB_NAME'),$processBefore]);`
  const values=JSON.parse(execFileSync(process.env.PHP_BINARY || 'C:/xampp/php/php.exe',['-r',script],{encoding:'utf8'}))
  assert.deepEqual(values,['scan_fixture','other_app'])
 } finally {rmSync(dir,{recursive:true,force:true})}
})
